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

// Music EQ chain connections (shared by both default and user music)
musicEQBass.connect(musicEQMidBass);
musicEQMidBass.connect(musicEQMid);
musicEQMid.connect(musicEQMidTreble);
musicEQMidTreble.connect(musicEQTreble);
musicEQTreble.connect(musicLowpassNode);
musicLowpassNode.connect(musicDryGain).connect(analyser);
musicLowpassNode.connect(musicReverbNode).connect(musicWetGain).connect(analyser);

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
let userMusicGain = null; // Gain node for current track
let nextMusicAudio = null; // For crossfade
let nextMusicGain = null; // Gain node for next track
let crossfadeDuration = 25; // seconds (default)
let isCrossfading = false;
let crossfadeCheckInterval = null;
let activeFadeInterval = null; // Store the active fade interval
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
    
    // Check if it's a custom preset
    const customPresets = JSON.parse(localStorage.getItem('customPresets') || '{}');
    if (customPresets[presetName]) {
        const preset = customPresets[presetName];
        rainVolumeSlider.value = preset.rainVolume;
        thunderVolumeSlider.value = preset.thunderVolume;
        lowpassFilterSlider.value = preset.lowpassFilter;
        musicVolumeSlider.value = preset.musicVolume;
        musicLowpassSlider.value = preset.musicLowpass;
        musicRoomSizeSlider.value = preset.musicRoomSize;
        musicReverbSlider.value = preset.musicReverb;
        rainReverbSlider.value = preset.rainReverb;
        thunderReverbSlider.value = preset.thunderReverb;
    } else if (presetName === 'indoorcozy') {
        // Indoor Cozy: 100% rain, heavy filtering, tiny room with reverb
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        musicVolumeSlider.value = 100;
        musicLowpassSlider.value = 22050; // Max - no filtering on music
        musicRoomSizeSlider.value = 0.02; // Very small room
        musicReverbSlider.value = 0.30; // Updated reverb mix
        rainReverbSlider.value = 0.50; // Rain reverb for indoor space
        thunderReverbSlider.value = 0.30; // Thunder reverb for indoor space
        
        // Do NOT auto-play music for Indoor Cozy preset
        
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
        
        // Connect to the start of the EQ chain (the chain itself is already connected during init)
        musicSource.connect(musicEQBass);
        
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

// Clean up track name for display (remove album info, track numbers, file extensions)
function getCleanTrackName(filename) {
    if (!filename) return '';
    
    // Remove file extension
    let name = filename.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '');
    
    // Try to parse common formats:
    // "Artist - Album - ## Title" -> "Artist - Title"
    // "Artist, Other Artist - Album - ## Title" -> "Artist, Other Artist - Title"
    
    // Split by " - " to get segments
    const segments = name.split(' - ');
    
    if (segments.length >= 3) {
        // Format: Artist - Album - Track# Title
        // Keep first segment (artist) and last segment (title)
        const artist = segments[0].trim();
        let title = segments[segments.length - 1].trim();
        
        // Remove leading track numbers from title (e.g., "03 Title" -> "Title")
        title = title.replace(/^\d{1,3}\s+/, '');
        
        return `${artist} - ${title}`;
    } else if (segments.length === 2) {
        // Format: Artist - Title (already clean)
        return name;
    } else {
        // Single segment, just remove track numbers if present
        return name.replace(/^\d{1,3}\s+/, '').trim();
    }
}

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
        
        // Auto-load first track if playlist has songs
        if (userPlaylist.length > 0) {
            currentTrackIndex = 0;
            updateCurrentTrackDisplay();
        } else {
            updateCurrentTrackDisplay();
        }
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
        
        // Add up-next class to the next track when crossfading
        const nextIndex = (currentTrackIndex + 1) % userPlaylist.length;
        if (isCrossfading && index === nextIndex) {
            item.classList.add('up-next');
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'track-name';
        nameSpan.textContent = getCleanTrackName(track.name);
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
    
    // Add animation to the moved track
    setTimeout(() => {
        const playlistItems = document.querySelectorAll('.playlist-item');
        if (playlistItems[newIndex]) {
            playlistItems[newIndex].classList.add('reordered');
            setTimeout(() => {
                playlistItems[newIndex].classList.remove('reordered');
            }, 400);
        }
    }, 10);
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
    const isDefaultPlaying = defaultMusicAudio && !defaultMusicAudio.paused;
    
    // Stop both default and user music
    if (isDefaultPlaying) {
        stopDefaultMusic();
    }
    stopUserMusic();
    
    currentTrackIndex = index;
    
    // Start playing if any music was playing, or just load and play the clicked track
    if (wasPlaying || isDefaultPlaying) {
        playUserMusic();
    } else {
        // User clicked a track when nothing was playing - start playing it
        playUserMusic();
    }
    
    // Add flash animation
    const currentDisplay = document.getElementById('current-track-display');
    if (currentDisplay) {
        currentDisplay.classList.add('track-changed');
        setTimeout(() => {
            currentDisplay.classList.remove('track-changed');
        }, 600);
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
    const currentDisplay = document.getElementById('current-track-display');
    const nextDisplay = document.getElementById('next-track-display');
    const summaryTrackName = document.getElementById('summary-track-name');
    const summaryTrackInfo = document.querySelector('.summary-track-info');
    if (!currentDisplay) return;
    
    const currentTrackName = currentDisplay.querySelector('.track-name');
    const nextTrackName = nextDisplay ? nextDisplay.querySelector('.track-name') : null;
    
    // Helper function to set text and check if scrolling is needed
    function setTextWithScroll(element, text) {
        if (!element) return;
        
        // Remove scrolling class first
        element.classList.remove('scrolling');
        
        // Wrap text in span if not already wrapped
        if (!element.querySelector('span')) {
            element.innerHTML = '<span></span>';
        }
        
        const span = element.querySelector('span');
        span.textContent = text;
        
        // Reset any transform
        span.style.transform = '';
        
        // Check if text overflows after a brief delay to allow layout
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const containerWidth = element.offsetWidth;
                const textWidth = span.offsetWidth;
                
                // Add some padding/tolerance (5px) to prevent unnecessary scrolling
                if (textWidth > containerWidth + 5) {
                    // Calculate only the overflow amount that needs to be scrolled
                    const overflowAmount = textWidth - containerWidth;
                    element.style.setProperty('--scroll-distance', `-${overflowAmount}px`);
                    element.classList.add('scrolling');
                } else {
                    // Make sure it's centered if no scrolling needed
                    element.style.removeProperty('--scroll-distance');
                }
            });
        });
    }
    
    if (isCrossfading && currentTrackIndex >= 0 && currentTrackIndex < userPlaylist.length) {
        // Show both current and next track during crossfade
        const nextIndex = (currentTrackIndex + 1) % userPlaylist.length;
        const cleanName = getCleanTrackName(userPlaylist[currentTrackIndex].name);
        const nextCleanName = getCleanTrackName(userPlaylist[nextIndex].name);
        
        setTextWithScroll(currentTrackName, cleanName);
        
        if (summaryTrackName) {
            // Show both tracks with distinction in collapsed summary
            const content = `<span class="current-track-summary">${cleanName}</span> <span class="arrow">→</span> <span class="next-track-summary">${nextCleanName}</span>`;
            summaryTrackName.innerHTML = `<span class="summary-content">${content}</span>`;
            
            // Check if summary needs scrolling - use requestAnimationFrame for accurate measurement
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const container = summaryTrackName;
                    const contentSpan = summaryTrackName.querySelector('.summary-content');
                    if (contentSpan) {
                        // Measure container width (constrained by max-width: 400px)
                        const containerWidth = container.offsetWidth;
                        
                        // Get the full natural width of the content using getBoundingClientRect for sub-pixel accuracy
                        const contentRect = contentSpan.getBoundingClientRect();
                        const contentWidth = Math.ceil(contentRect.width);
                        
                        if (contentWidth > containerWidth + 5) {
                            // Add extra 10px buffer to ensure all text is visible
                            const overflowAmount = contentWidth - containerWidth + 10;
                            container.style.setProperty('--summary-scroll-distance', `-${overflowAmount}px`);
                            container.classList.add('scrolling');
                        } else {
                            container.classList.remove('scrolling');
                            container.style.removeProperty('--summary-scroll-distance');
                        }
                    }
                });
            });
        }
        if (summaryTrackInfo) {
            summaryTrackInfo.classList.add('crossfading');
        }
        if (nextDisplay && nextTrackName) {
            nextDisplay.classList.add('visible');
            nextDisplay.classList.add('crossfade-active');
            
            // Wait for the transition to complete before calculating scroll
            setTimeout(() => {
                setTextWithScroll(currentTrackName, cleanName);
                setTextWithScroll(nextTrackName, nextCleanName);
            }, 450); // Slightly longer than the 0.4s transition
        }
    } else if (currentTrackIndex >= 0 && currentTrackIndex < userPlaylist.length) {
        // Show only current track
        const cleanName = getCleanTrackName(userPlaylist[currentTrackIndex].name);
        
        if (summaryTrackName) {
            summaryTrackName.textContent = cleanName;
            summaryTrackName.classList.remove('scrolling');
        }
        if (summaryTrackInfo) {
            summaryTrackInfo.classList.remove('crossfading');
        }
        if (nextDisplay) {
            nextDisplay.classList.remove('visible');
            nextDisplay.classList.remove('crossfade-active');
            
            // Wait for the transition to complete before calculating scroll
            setTimeout(() => {
                setTextWithScroll(currentTrackName, cleanName);
            }, 450);
        } else {
            setTextWithScroll(currentTrackName, cleanName);
        }
    } else if (defaultMusicAudio && !defaultMusicAudio.paused) {
        setTextWithScroll(currentTrackName, 'Default Music');
        
        if (summaryTrackName) {
            summaryTrackName.textContent = 'Default Music';
        }
        if (summaryTrackInfo) {
            summaryTrackInfo.classList.remove('crossfading');
        }
        if (nextDisplay) {
            nextDisplay.classList.remove('visible');
            nextDisplay.classList.remove('crossfade-active');
        }
    } else {
        if (currentTrackName) {
            currentTrackName.classList.remove('scrolling');
            currentTrackName.innerHTML = '<span>No track loaded</span>';
        }
        if (summaryTrackName) {
            summaryTrackName.textContent = 'No track loaded';
        }
        if (summaryTrackInfo) {
            summaryTrackInfo.classList.remove('crossfading');
        }
        if (nextDisplay) {
            nextDisplay.classList.remove('visible');
            nextDisplay.classList.remove('crossfade-active');
        }
    }
}

// Play user music with full audio chain
function playUserMusic() {
    if (currentTrackIndex < 0 || currentTrackIndex >= userPlaylist.length) return;
    
    // Don't cancel crossfade if just resuming playback
    // Only cancel if we're loading a different track
    const track = userPlaylist[currentTrackIndex];
    if (!track.url) return;
    
    const isResumingSameTrack = userMusicAudio && userMusicAudio.paused && userMusicAudio.src === track.url;
    
    if (!isResumingSameTrack && isCrossfading) {
        // Loading a new track, cancel crossfade
        cancelCrossfade();
    }
    
    // Resume AudioContext if suspended
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (!userMusicAudio) {
        userMusicAudio = new Audio();
        userMusicGain = audioCtx.createGain();
        
        const musicSource = audioCtx.createMediaElementSource(userMusicAudio);
        
        // Connect through gain node for crossfade control, then to EQ chain
        musicSource.connect(userMusicGain);
        userMusicGain.connect(musicEQBass);
        
        // Set initial volume
        const musicVolumeSlider = document.getElementById('musicVolume');
        const targetVolume = musicVolumeSlider ? parseFloat(musicVolumeSlider.value) / 100 : 1;
        userMusicGain.gain.value = targetVolume;
        
        // Auto-advance to next track when current ends
        userMusicAudio.addEventListener('ended', () => {
            if (!isCrossfading) {
                playNextTrack();
            }
        });
        
        // Update track position as song plays
        userMusicAudio.addEventListener('timeupdate', updateTrackPosition);
        userMusicAudio.addEventListener('loadedmetadata', updateTrackDuration);
        
        // Monitor for crossfade timing
        userMusicAudio.addEventListener('timeupdate', checkCrossfadeTime);
    } else if (!isResumingSameTrack) {
        // Loading a new track - ensure gain is at proper volume
        const musicVolumeSlider = document.getElementById('musicVolume');
        const targetVolume = musicVolumeSlider ? parseFloat(musicVolumeSlider.value) / 100 : 1;
        userMusicGain.gain.value = targetVolume;
    }
    // If resuming same track, keep current gain value (might be mid-crossfade)
    
    // If audio is paused, just resume; otherwise load new track
    if (isResumingSameTrack) {
        // Simply resume playback at current position
        userMusicAudio.play().catch(err => {
            console.error('Music playback failed:', err);
        });
        
        // Resume next track too if crossfading
        if (isCrossfading && nextMusicAudio && nextMusicAudio.paused) {
            nextMusicAudio.play().catch(err => {
                console.error('Next track playback failed:', err);
            });
        }
    } else {
        // Load and play new track
        userMusicAudio.src = track.url;
        
        // Force metadata load and update duration when ready
        userMusicAudio.addEventListener('loadedmetadata', function updateDurationOnce() {
            updateTrackDuration();
            userMusicAudio.removeEventListener('loadedmetadata', updateDurationOnce);
        });
        
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
    
    // Also pause next track if crossfading
    if (isCrossfading && nextMusicAudio) {
        nextMusicAudio.pause();
    }
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
}

// Stop user music
function stopUserMusic() {
    // Cancel any active crossfade first
    cancelCrossfade();
    
    if (userMusicAudio) {
        userMusicAudio.pause();
        userMusicAudio.currentTime = 0;
    }
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
}

// Cancel active crossfade and clean up
function cancelCrossfade() {
    if (!isCrossfading) return;
    
    // Clear the fade interval
    if (activeFadeInterval) {
        clearInterval(activeFadeInterval);
        activeFadeInterval = null;
    }
    
    // Stop and clean up next track
    if (nextMusicAudio) {
        nextMusicAudio.pause();
        nextMusicAudio.currentTime = 0;
        nextMusicAudio = null;
    }
    
    if (nextMusicGain) {
        nextMusicGain.disconnect();
        nextMusicGain = null;
    }
    
    // Restore current track volume to full
    if (userMusicGain) {
        const musicVolumeSlider = document.getElementById('musicVolume');
        const targetVolume = musicVolumeSlider ? parseFloat(musicVolumeSlider.value) / 100 : 1;
        userMusicGain.gain.value = targetVolume;
    }
    
    isCrossfading = false;
    
    // Update display
    updateCurrentTrackDisplay();
    renderPlaylist();
}

// ==================== CROSSFADE FUNCTIONS ====================
function checkCrossfadeTime() {
    if (!userMusicAudio || isCrossfading || crossfadeDuration === 0) return;
    if (!userMusicAudio.duration || isNaN(userMusicAudio.duration)) return;
    
    const timeRemaining = userMusicAudio.duration - userMusicAudio.currentTime;
    
    // Start crossfade when remaining time equals crossfade duration
    if (timeRemaining <= crossfadeDuration && timeRemaining > 0) {
        startCrossfade();
    }
}

function startCrossfade() {
    if (isCrossfading || userPlaylist.length <= 1 || crossfadeDuration === 0) return;
    
    isCrossfading = true;
    
    // Determine next track index
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= userPlaylist.length) {
        nextIndex = 0; // Loop to beginning
    }
    
    const nextTrack = userPlaylist[nextIndex];
    if (!nextTrack.url) {
        isCrossfading = false;
        return;
    }
    
    // Create and set up next audio element with its own gain node
    nextMusicAudio = new Audio();
    nextMusicAudio.src = nextTrack.url;
    nextMusicGain = audioCtx.createGain();
    nextMusicGain.gain.value = 0; // Start silent
    
    const nextMusicSource = audioCtx.createMediaElementSource(nextMusicAudio);
    nextMusicSource.connect(nextMusicGain);
    nextMusicGain.connect(musicEQBass);
    
    // Start playing the next track (silently)
    nextMusicAudio.play().catch(err => {
        console.error('Next track playback failed:', err);
        isCrossfading = false;
    });
    
    // Update display to show crossfade
    updateCurrentTrackDisplay();
    renderPlaylist(); // Update playlist to show up-next animation
    
    // Perform the crossfade
    activeFadeInterval = setInterval(() => {
        if (!userMusicAudio || !nextMusicAudio) {
            clearInterval(activeFadeInterval);
            activeFadeInterval = null;
            return;
        }
        
        const timeRemaining = userMusicAudio.duration - userMusicAudio.currentTime;
        const fadeProgress = 1 - (timeRemaining / crossfadeDuration);
        
        if (fadeProgress >= 1 || timeRemaining <= 0) {
            // Crossfade complete
            clearInterval(activeFadeInterval);
            activeFadeInterval = null;
            completeCrossfade(nextIndex);
        } else {
            // Get current target volume from slider (in real-time)
            const musicVolumeSlider = document.getElementById('musicVolume');
            const targetVolume = musicVolumeSlider ? parseFloat(musicVolumeSlider.value) / 100 : 1;
            
            // Fade out current, fade in next using gain nodes
            userMusicGain.gain.value = targetVolume * (1 - fadeProgress);
            nextMusicGain.gain.value = targetVolume * fadeProgress;
        }
    }, 50);
}

function completeCrossfade(nextIndex) {
    // Stop and disconnect old audio
    if (userMusicAudio) {
        userMusicAudio.pause();
        userMusicAudio.currentTime = 0;
    }
    
    // Swap audio elements and gain nodes
    userMusicAudio = nextMusicAudio;
    userMusicGain = nextMusicGain;
    nextMusicAudio = null;
    nextMusicGain = null;
    
    // Update track index
    currentTrackIndex = nextIndex;
    
    // Reset crossfade state BEFORE updating display
    isCrossfading = false;
    
    // Add flash animation to current track display
    const currentDisplay = document.getElementById('current-track-display');
    if (currentDisplay) {
        currentDisplay.classList.add('track-changed');
        setTimeout(() => {
            currentDisplay.classList.remove('track-changed');
        }, 600);
    }
    
    // Update UI now that crossfade is complete
    updateCurrentTrackDisplay();
    renderPlaylist();
    
    // Update track duration immediately (metadata is already loaded)
    if (userMusicAudio.duration && !isNaN(userMusicAudio.duration)) {
        updateTrackDuration();
    }
    
    // Set up event listeners for the new current track
    userMusicAudio.addEventListener('timeupdate', updateTrackPosition);
    userMusicAudio.addEventListener('loadedmetadata', updateTrackDuration);
    userMusicAudio.addEventListener('timeupdate', checkCrossfadeTime);
    userMusicAudio.addEventListener('ended', () => {
        if (!isCrossfading) {
            playNextTrack();
        }
    });
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
    // Cancel any active crossfade when seeking
    if (isCrossfading) {
        cancelCrossfade();
    }
    
    // Use whichever audio is currently active
    const activeAudio = (userMusicAudio && !userMusicAudio.paused) ? userMusicAudio : defaultMusicAudio;
    if (!activeAudio || !activeAudio.duration) return;
    
    const newTime = (percentage / 100) * activeAudio.duration;
    activeAudio.currentTime = newTime;
    
    // After seeking, check if we should restart crossfade
    // This will be handled automatically by the timeupdate event triggering checkCrossfadeTime()
    // But we can force an immediate check for responsiveness
    if (userMusicAudio && !userMusicAudio.paused) {
        requestAnimationFrame(() => {
            checkCrossfadeTime();
        });
    }
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
    const presetOutdoorBtn = document.getElementById('presetOutdoor');
    
    if (presetIndoorCozyBtn) {
        presetIndoorCozyBtn.addEventListener('click', () => applyPreset('indoorcozy'));
    }
    if (presetOutdoorBtn) {
        presetOutdoorBtn.addEventListener('click', () => applyPreset('outdoor'));
    }
    
    // ===== CUSTOM PRESET MANAGEMENT =====
    const savePresetBtn = document.getElementById('savePresetBtn');
    const customPresetNameInput = document.getElementById('customPresetName');
    const customPresetsContainer = document.getElementById('customPresetsContainer');
    
    function loadCustomPresets() {
        const customPresets = JSON.parse(localStorage.getItem('customPresets') || '{}');
        customPresetsContainer.innerHTML = '';
        
        Object.keys(customPresets).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = name;
            btn.style.position = 'relative';
            btn.style.paddingRight = '30px';
            
            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = '✕';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.right = '8px';
            deleteBtn.style.top = '50%';
            deleteBtn.style.transform = 'translateY(-50%)';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.color = '#ff4444';
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const presets = JSON.parse(localStorage.getItem('customPresets') || '{}');
                delete presets[name];
                localStorage.setItem('customPresets', JSON.stringify(presets));
                loadCustomPresets();
            });
            
            btn.appendChild(deleteBtn);
            btn.addEventListener('click', () => applyPreset(name));
            customPresetsContainer.appendChild(btn);
        });
    }
    
    if (savePresetBtn && customPresetNameInput) {
        savePresetBtn.addEventListener('click', () => {
            const name = customPresetNameInput.value.trim();
            if (!name) {
                alert('Please enter a preset name');
                return;
            }
            
            const preset = {
                rainVolume: parseFloat(document.getElementById('rainVolume').value),
                thunderVolume: parseFloat(document.getElementById('thunderVolume').value),
                lowpassFilter: parseFloat(document.getElementById('lowpassFilter').value),
                musicVolume: parseFloat(document.getElementById('musicVolume').value),
                musicLowpass: parseFloat(document.getElementById('musicLowpass').value),
                musicRoomSize: parseFloat(document.getElementById('musicRoomSize').value),
                musicReverb: parseFloat(document.getElementById('musicReverb').value),
                rainReverb: parseFloat(document.getElementById('rainReverb').value),
                thunderReverb: parseFloat(document.getElementById('thunderReverb').value)
            };
            
            const customPresets = JSON.parse(localStorage.getItem('customPresets') || '{}');
            customPresets[name] = preset;
            localStorage.setItem('customPresets', JSON.stringify(customPresets));
            
            customPresetNameInput.value = '';
            loadCustomPresets();
        });
    }
    
    // Load custom presets on startup
    loadCustomPresets();
    
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
    
    // ===== CROSSFADE CONTROL =====
    const crossfadeDurationSlider = document.getElementById('crossfadeDuration');
    const crossfadeDurationLabel = document.getElementById('crossfadeDurationLabel');
    
    // Load saved crossfade duration from localStorage
    const savedCrossfade = localStorage.getItem('crossfadeDuration');
    if (savedCrossfade !== null) {
        crossfadeDuration = parseFloat(savedCrossfade);
        if (crossfadeDurationSlider) crossfadeDurationSlider.value = crossfadeDuration;
        if (crossfadeDurationLabel) crossfadeDurationLabel.textContent = crossfadeDuration.toFixed(1) + 's';
    }
    
    if (crossfadeDurationSlider) {
        crossfadeDurationSlider.addEventListener('input', () => {
            crossfadeDuration = parseFloat(crossfadeDurationSlider.value);
            if (crossfadeDurationLabel) {
                crossfadeDurationLabel.textContent = crossfadeDuration.toFixed(1) + 's';
            }
            // Save to localStorage
            localStorage.setItem('crossfadeDuration', crossfadeDuration);
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
        const volume = parseFloat(musicVolumeSlider.value) / 100;
        
        // If crossfading, don't override gain values - the crossfade interval manages them
        if (isCrossfading) {
            // Just store the target volume, the crossfade will use it
            // Don't directly set gain values during crossfade
        } else {
            // Update user music gain node if it exists (only when not crossfading)
            if (userMusicGain) {
                userMusicGain.gain.value = volume;
            }
        }
        
        // Update default music volume
        if (defaultMusicAudio) {
            defaultMusicAudio.volume = volume;
        }
        
        // Sync with playback volume slider
        const playbackVolumeSlider = document.getElementById('playbackMusicVolume');
        const playbackVolumeLabel = document.getElementById('playbackMusicVolumeLabel');
        if (playbackVolumeSlider && playbackVolumeSlider.value !== musicVolumeSlider.value) {
            playbackVolumeSlider.value = musicVolumeSlider.value;
            if (playbackVolumeLabel) {
                playbackVolumeLabel.textContent = musicVolumeSlider.value;
            }
        }
    });
    
    // Sync playback volume slider with main music volume slider
    const playbackVolumeSlider = document.getElementById('playbackMusicVolume');
    const playbackVolumeLabel = document.getElementById('playbackMusicVolumeLabel');
    if (playbackVolumeSlider) {
        playbackVolumeSlider.addEventListener('input', () => {
            const value = playbackVolumeSlider.value;
            musicVolumeSlider.value = value;
            musicVolumeSlider.dispatchEvent(new Event('input'));
            if (playbackVolumeLabel) {
                playbackVolumeLabel.textContent = value;
            }
        });
    }
    
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
        musicRoomSizeLabel.textContent = sliderValue.toFixed(2);
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
    
    // ===== STANDALONE PANELS =====
    const standalonePanels = document.querySelectorAll('details.standalone-panel');
    standalonePanels.forEach((panel, idx) => {
        const key = 'stormgen_standalone_' + idx;
        const saved = localStorage.getItem(key);
        
        // Restore state from localStorage, default to closed
        if (saved === 'open') {
            panel.open = true;
        } else {
            panel.open = false;
        }
        
        panel.addEventListener('toggle', () => {
            localStorage.setItem(key, panel.open ? 'open' : 'closed');
            
            // Make waveform sticky when OSC panel is opened
            const waveformContainer = document.getElementById('waveform-container');
            const summary = panel.querySelector('summary');
            if (summary && summary.textContent.includes('OSC') && waveformContainer) {
                if (panel.open) {
                    waveformContainer.style.position = 'sticky';
                    waveformContainer.style.top = '0';
                    waveformContainer.style.zIndex = '100';
                } else {
                    waveformContainer.style.position = 'relative';
                    waveformContainer.style.top = 'auto';
                    waveformContainer.style.zIndex = 'auto';
                }
            }
        });
        
        // Initialize sticky state on page load if OSC panel is open
        const waveformContainer = document.getElementById('waveform-container');
        const summary = panel.querySelector('summary');
        if (summary && summary.textContent.includes('OSC') && waveformContainer && panel.open) {
            waveformContainer.style.position = 'sticky';
            waveformContainer.style.top = '0';
            waveformContainer.style.zIndex = '100';
        }
    });
    
    // ===== OSC CONTROLS =====
    
    // Display mode buttons
    const oscModeButtons = document.querySelectorAll('.osc-mode-btn');
    oscModeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            oscModeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            oscSettings.mode = btn.dataset.mode;
        });
    });
    
    // Line width
    const oscLineWidthSlider = document.getElementById('oscLineWidth');
    const oscLineWidthLabel = document.getElementById('oscLineWidthLabel');
    if (oscLineWidthSlider) {
        oscLineWidthSlider.addEventListener('input', () => {
            oscSettings.lineWidth = parseFloat(oscLineWidthSlider.value);
            oscLineWidthLabel.textContent = oscLineWidthSlider.value;
        });
    }
    
    // Glow intensity
    const oscGlowSlider = document.getElementById('oscGlowIntensity');
    const oscGlowLabel = document.getElementById('oscGlowIntensityLabel');
    if (oscGlowSlider) {
        oscGlowSlider.addEventListener('input', () => {
            oscSettings.glowIntensity = parseFloat(oscGlowSlider.value);
            oscGlowLabel.textContent = oscGlowSlider.value;
        });
    }
    
    // Amplification
    const oscAmpSlider = document.getElementById('oscAmplification');
    const oscAmpLabel = document.getElementById('oscAmplificationLabel');
    if (oscAmpSlider) {
        oscAmpSlider.addEventListener('input', () => {
            oscSettings.amplification = parseFloat(oscAmpSlider.value);
            oscAmpLabel.textContent = oscAmpSlider.value + 'x';
        });
    }
    
    // Smoothing
    const oscSmoothingSlider = document.getElementById('oscSmoothing');
    const oscSmoothingLabel = document.getElementById('oscSmoothingLabel');
    if (oscSmoothingSlider) {
        oscSmoothingSlider.addEventListener('input', () => {
            const value = parseFloat(oscSmoothingSlider.value);
            oscSettings.smoothing = value;
            analyser.smoothingTimeConstant = value;
            oscSmoothingLabel.textContent = value.toFixed(2);
        });
    }
    
    // FFT Size
    const oscFFTSlider = document.getElementById('oscFFTSize');
    const oscFFTLabel = document.getElementById('oscFFTSizeLabel');
    if (oscFFTSlider) {
        oscFFTSlider.addEventListener('input', () => {
            const power = parseInt(oscFFTSlider.value);
            const size = Math.pow(2, power);
            oscSettings.fftSize = size;
            analyser.fftSize = size;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            oscFFTLabel.textContent = size.toString();
        });
    }
    
    // Color picker
    const oscColorPicker = document.getElementById('oscColor');
    if (oscColorPicker) {
        oscColorPicker.addEventListener('input', () => {
            oscSettings.color = oscColorPicker.value;
        });
    }
    
    // Background color
    const oscBgColorPicker = document.getElementById('oscBgColor');
    if (oscBgColorPicker) {
        oscBgColorPicker.addEventListener('input', () => {
            oscSettings.bgColor = oscBgColorPicker.value;
        });
    }
    
    // Fade trail
    const oscFadeTrailSlider = document.getElementById('oscFadeTrail');
    const oscFadeTrailLabel = document.getElementById('oscFadeTrailLabel');
    if (oscFadeTrailSlider) {
        oscFadeTrailSlider.addEventListener('input', () => {
            const value = parseFloat(oscFadeTrailSlider.value);
            oscSettings.fadeTrail = value;
            oscFadeTrailLabel.textContent = value === 0 ? 'Off' : value.toFixed(2);
        });
    }
    
    // Mirror checkbox
    const oscMirrorCheckbox = document.getElementById('oscMirror');
    if (oscMirrorCheckbox) {
        oscMirrorCheckbox.addEventListener('change', () => {
            oscSettings.mirror = oscMirrorCheckbox.checked;
        });
    }
    
    // Fill checkbox
    const oscFillCheckbox = document.getElementById('oscFill');
    if (oscFillCheckbox) {
        oscFillCheckbox.addEventListener('change', () => {
            oscSettings.fill = oscFillCheckbox.checked;
        });
    }
    
    // Dots checkbox
    const oscDotsCheckbox = document.getElementById('oscDots');
    if (oscDotsCheckbox) {
        oscDotsCheckbox.addEventListener('change', () => {
            oscSettings.dots = oscDotsCheckbox.checked;
        });
    }
    
    // Rainbow checkbox
    const oscRainbowCheckbox = document.getElementById('oscRainbow');
    if (oscRainbowCheckbox) {
        oscRainbowCheckbox.addEventListener('change', () => {
            oscSettings.rainbow = oscRainbowCheckbox.checked;
        });
    }
});

// ==================== WAVEFORM VISUALIZER ====================
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

// Oscilloscope settings (defaults)
let oscSettings = {
    mode: 'waveform', // 'waveform', 'bars', 'circular'
    lineWidth: 2,
    glowIntensity: 10,
    amplification: 1,
    smoothing: 0.8,
    fftSize: 2048,
    color: '#00ff41',
    bgColor: '#000a05',
    fadeTrail: 0,
    mirror: false,
    fill: false,
    dots: false,
    rainbow: false
};

// Use the analyzer already created at the top
let dataArray = new Uint8Array(analyser.frequencyBinCount);

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    
    analyser.getByteTimeDomainData(dataArray);
    
    // Background with optional fade trail effect
    if (oscSettings.fadeTrail > 0) {
        canvasCtx.fillStyle = `rgba(0, 10, 5, ${1 - oscSettings.fadeTrail})`;
    } else {
        const bgColor = hexToRgb(oscSettings.bgColor);
        canvasCtx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
    }
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw based on selected mode
    if (oscSettings.mode === 'waveform') {
        drawWaveformMode();
    } else if (oscSettings.mode === 'bars') {
        drawBarsMode();
    } else if (oscSettings.mode === 'circular') {
        drawCircularMode();
    }
}

function drawWaveformMode() {
    const bufferLength = dataArray.length;
    
    // Draw grid lines
    canvasCtx.strokeStyle = `${oscSettings.color}33`; // 20% opacity
    canvasCtx.lineWidth = 1;
    canvasCtx.shadowBlur = 0;
    
    // Horizontal center line
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, canvas.height / 2);
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
    
    // Waveform
    canvasCtx.lineWidth = oscSettings.lineWidth;
    canvasCtx.shadowBlur = oscSettings.glowIntensity;
    canvasCtx.shadowColor = oscSettings.color;
    
    // Optional fill
    if (oscSettings.fill) {
        const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
        const color = hexToRgb(oscSettings.color);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);
        canvasCtx.fillStyle = gradient;
    }
    
    canvasCtx.beginPath();
    
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    
    const points = [];
    
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = ((v - 1) * oscSettings.amplification + 1) * canvas.height / 2;
        points.push({x, y});
        x += sliceWidth;
    }
    
    // Draw main waveform
    drawPoints(points, oscSettings.color);
    
    // Mirror effect
    if (oscSettings.mirror) {
        const mirroredPoints = points.map(p => ({
            x: p.x,
            y: canvas.height - p.y
        }));
        drawPoints(mirroredPoints, oscSettings.color);
    }
}

function drawPoints(points, baseColor) {
    canvasCtx.beginPath();
    
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // Rainbow mode
        if (oscSettings.rainbow) {
            const hue = (i / points.length) * 360;
            canvasCtx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
            canvasCtx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        } else {
            canvasCtx.strokeStyle = baseColor;
        }
        
        if (oscSettings.dots) {
            // Dots mode
            canvasCtx.fillStyle = oscSettings.rainbow ? `hsl(${(i / points.length) * 360}, 100%, 50%)` : baseColor;
            canvasCtx.beginPath();
            canvasCtx.arc(point.x, point.y, oscSettings.lineWidth / 2, 0, Math.PI * 2);
            canvasCtx.fill();
        } else {
            // Line mode
            if (i === 0) {
                canvasCtx.moveTo(point.x, point.y);
            } else {
                canvasCtx.lineTo(point.x, point.y);
            }
        }
    }
    
    if (!oscSettings.dots) {
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
        
        // Fill under wave
        if (oscSettings.fill) {
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.lineTo(0, canvas.height / 2);
            canvasCtx.closePath();
            canvasCtx.fill();
        }
    }
}

function drawBarsMode() {
    const bufferLength = dataArray.length;
    const barWidth = canvas.width / bufferLength;
    
    canvasCtx.shadowBlur = oscSettings.glowIntensity;
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255.0) * canvas.height * oscSettings.amplification;
        const x = i * barWidth;
        const y = canvas.height / 2 - barHeight / 2;
        
        if (oscSettings.rainbow) {
            const hue = (i / bufferLength) * 360;
            canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            canvasCtx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        } else {
            canvasCtx.fillStyle = oscSettings.color;
            canvasCtx.shadowColor = oscSettings.color;
        }
        
        canvasCtx.fillRect(x, y, barWidth - 1, barHeight);
        
        // Mirror effect
        if (oscSettings.mirror) {
            canvasCtx.fillRect(x, canvas.height / 2 + barHeight / 2, barWidth - 1, barHeight);
        }
    }
}

function drawCircularMode() {
    const bufferLength = dataArray.length;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    canvasCtx.lineWidth = oscSettings.lineWidth;
    canvasCtx.shadowBlur = oscSettings.glowIntensity;
    canvasCtx.shadowColor = oscSettings.color;
    
    canvasCtx.beginPath();
    
    for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2;
        const amplitude = (dataArray[i] / 255.0) * oscSettings.amplification;
        const r = radius + amplitude * 100;
        
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        
        if (oscSettings.rainbow) {
            const hue = (i / bufferLength) * 360;
            canvasCtx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
            canvasCtx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        } else {
            canvasCtx.strokeStyle = oscSettings.color;
        }
        
        if (oscSettings.dots) {
            canvasCtx.fillStyle = oscSettings.rainbow ? `hsl(${(i / bufferLength) * 360}, 100%, 50%)` : oscSettings.color;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, oscSettings.lineWidth / 2, 0, Math.PI * 2);
            canvasCtx.fill();
        } else {
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
        }
    }
    
    if (!oscSettings.dots) {
        canvasCtx.closePath();
        canvasCtx.stroke();
        
        if (oscSettings.fill) {
            const color = hexToRgb(oscSettings.color);
            canvasCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`;
            canvasCtx.fill();
        }
    }
    
    // Mirror effect (inner circle)
    if (oscSettings.mirror) {
        canvasCtx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
            const angle = (i / bufferLength) * Math.PI * 2;
            const amplitude = (dataArray[i] / 255.0) * oscSettings.amplification;
            const r = radius - amplitude * 100;
            
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
        }
        canvasCtx.closePath();
        canvasCtx.stroke();
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : {r: 0, g: 255, b: 65};
}

// Start the visualizer
drawWaveform();


// ==================== IMMEDIATE THEME INITIALIZATION ====================
// Load theme colors IMMEDIATELY (before DOMContentLoaded) to prevent flash
(function() {
    const savedColor = localStorage.getItem('stormgen-theme-color');
    const savedColorRgb = localStorage.getItem('stormgen-theme-color-rgb');
    const savedSecondary = localStorage.getItem('stormgen-secondary-color');
    const savedSecondaryRgb = localStorage.getItem('stormgen-secondary-color-rgb');
    
    if (savedColor && savedColorRgb) {
        document.documentElement.style.setProperty('--theme-color', savedColor);
        document.documentElement.style.setProperty('--theme-color-rgb', savedColorRgb);
    } else {
        // Set default bright green for structural elements
        document.documentElement.style.setProperty('--theme-color', '#00ff41');
        document.documentElement.style.setProperty('--theme-color-rgb', '0, 255, 65');
    }
    
    if (savedSecondary && savedSecondaryRgb) {
        document.documentElement.style.setProperty('--secondary-accent', savedSecondary);
        document.documentElement.style.setProperty('--secondary-accent-rgb', savedSecondaryRgb);
    } else {
        // Set lighter yellow-green for UI elements for better balance
        document.documentElement.style.setProperty('--secondary-accent', '#88ff66');
        document.documentElement.style.setProperty('--secondary-accent-rgb', '136, 255, 102');
    }
})();

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
const musicReverbBass = audioCtx.createBiquadFilter();
const rainReverbNode = audioCtx.createConvolver();
const rainWetGain = audioCtx.createGain();
const rainDryGain = audioCtx.createGain();
const rainReverbBass = audioCtx.createBiquadFilter();
const thunderReverbNode = audioCtx.createConvolver();
const thunderWetGain = audioCtx.createGain();
const thunderDryGain = audioCtx.createGain();
const thunderReverbBass = audioCtx.createBiquadFilter();

// 3D Spatial audio nodes
const musicPannerNode = audioCtx.createStereoPanner();
musicPannerNode.pan.value = 0;

// Spatial head-shadow lowpass (only affects direct dry signal, NOT reverb)
const spatialDryLowpass = audioCtx.createBiquadFilter();
spatialDryLowpass.type = 'lowpass';
spatialDryLowpass.frequency.value = 22050; // Start with no filtering

// Spatial head-shadow bass shelf (scooped sound when behind listener)
// Boosts bass to create U-shaped EQ curve (scooped mids) for behind-the-head effect
const spatialDryBassShelf = audioCtx.createBiquadFilter();
spatialDryBassShelf.type = 'highshelf';
spatialDryBassShelf.frequency.value = 200; // Low end shelf
spatialDryBassShelf.gain.value = 0; // Start with no boost

// Spatial head-shadow lowpass for reverb path (same settings as dry)
const spatialWetLowpass = audioCtx.createBiquadFilter();
spatialWetLowpass.type = 'lowpass';
spatialWetLowpass.frequency.value = 22050; // Start with no filtering

// Mid-side processing for directional presence when behind listener
// Create a mid-range filter for M/S processing (affects centered info, not stereo width)
const midRangeFilter = audioCtx.createBiquadFilter();
midRangeFilter.type = 'peaking';
midRangeFilter.frequency.value = 1000; // Center around 1000 Hz for presence region
midRangeFilter.Q.value = 0.5; // Wide bandwidth to catch 500-2000 Hz range
midRangeFilter.gain.value = 0; // Will be adjusted based on spatial position

// Store base values for spatial audio adjustments
let baseMidEQ = 0;
let baseMusicReverb = 0; // Spatial controller now fully controls reverb
let isSpatialUpdate = false; // Flag to prevent listener from updating baseMidEQ during spatial updates
let isUserDraggingSlider = false; // Track if user is actively dragging the slider

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
musicEQMidBass.Q.value = 0.5; // Lower Q = wider bandwidth to cover more of the presence region
musicEQMidBass.gain.value = 0;

musicEQMid.type = 'peaking';
musicEQMid.frequency.value = 1500;
musicEQMid.Q.value = 0.7; // Lower Q for wider bandwidth
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
musicReverbBass.type = 'lowshelf';
musicReverbBass.frequency.value = 160;
musicReverbBass.gain.value = 0;
rainReverbBass.type = 'lowshelf';
rainReverbBass.frequency.value = 180;
rainReverbBass.gain.value = 0;
thunderReverbBass.type = 'lowshelf';
thunderReverbBass.frequency.value = 140;
thunderReverbBass.gain.value = 0;

// Default volumes (will be set from sliders on page load)
rainGainNode.gain.value = 0.25;
thunderGainNode.gain.value = 0.5;
birdsGainNode.gain.value = 0;

// Audio connections
rainGainNode.connect(rainEQNode);
rainEQNode.connect(lowpassFilterNode);
// Rain reverb routing: split to wet (reverb) and dry paths BEFORE the shared lowpass
rainEQNode.connect(rainDryGain).connect(lowpassFilterNode);
// TEMPORARILY DISABLED: rainReverbNode convolver for buffer issue debugging
// rainEQNode.connect(rainReverbNode).connect(rainWetGain).connect(rainReverbBass).connect(lowpassFilterNode);
// Final rain output goes through lowpass to analyzer and destination
lowpassFilterNode.connect(analyser);

// Thunder reverb routing: thunder has its own reverb chain, then goes through lowpass
thunderGainNode.connect(thunderDryGain).connect(lowpassFilterNode);
thunderGainNode.connect(thunderReverbNode).connect(thunderWetGain).connect(thunderReverbBass).connect(lowpassFilterNode);

birdsGainNode.connect(lowpassFilterNode);

// Music EQ chain connections (shared by both default and user music)
musicEQBass.connect(musicEQMidBass);
musicEQMidBass.connect(musicEQMid);
musicEQMid.connect(musicEQMidTreble);
musicEQMidTreble.connect(musicEQTreble);

// Split after EQ: DRY and WET paths split here with NO shared spatial processing
// Dry path: EQ -> panner -> spatial dry lowpass -> spatial bass shelf -> dry gain -> mid-range filter -> analyser
// Wet path: EQ -> reverb -> wet gain -> reverb bass (original unprocessed signal for room reflections)
musicEQTreble.connect(musicPannerNode);
musicPannerNode.connect(spatialDryLowpass);
spatialDryLowpass.connect(spatialDryBassShelf);
spatialDryBassShelf.connect(musicDryGain).connect(midRangeFilter).connect(analyser);

// Reverb path: EQ (unprocessed by spatial filters) -> reverb -> wet gain -> reverb bass -> analyser
musicEQTreble.connect(musicReverbNode).connect(musicWetGain).connect(musicReverbBass).connect(analyser);

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
        weatherIcon.textContent = '🔆'; // Sunny - no storm
        return;
    }
    
    const rainVolume = parseFloat(document.getElementById('rainVolume').value);
    
    // Determine icon based on rain volume when storm is active
    if (rainVolume === 0) {
        weatherIcon.textContent = '☀'; // Sunny - no rain
    } else {
        weatherIcon.textContent = '☁'; // Cloud with rain (no lightning)
    }
}

function showLightningIcon() {
    if (!weatherIcon) return;
    
    const titleRow = document.querySelector('.title-row');
    const lightningMode = document.getElementById('oscLightningMode')?.value || 'off';
    const useLongFlash = Math.random() < 0.2; // lower chance for long fades but still possible in any mode
    // Animation durations must match CSS animation durations to allow full animation playback
    const flashDuration = useLongFlash ? 1600 : 800; // Match CSS: short=0.8s, long=1.6s (for background) or 1.4s (for others)
    const body = document.body;
    
    // Show lightning bolt overlay on cloud
    const originalIcon = weatherIcon.textContent;
    weatherIcon.textContent = '⚡'; // Lightning bolt

    // Helper to apply chosen visual mode
    const applyFlash = () => {
        if (lightningMode === 'invert') {
            if (titleRow) {
                if (useLongFlash) {
                    titleRow.classList.add('lightning-invert-long');
                } else {
                    titleRow.classList.add('lightning-invert');
                }
            }
        } else if (lightningMode === 'bright') {
            if (titleRow) {
                if (useLongFlash) {
                    titleRow.classList.add('lightning-bright-long');
                } else {
                    titleRow.classList.add('lightning-bright');
                }
            }
        } else if (lightningMode === 'background') {
            if (body) {
                const className = useLongFlash ? 'flash-background-long' : 'flash-background';
                body.classList.add(className);
            }
        }
    };

    // Helper to clear classes between flashes
    const clearFlash = () => {
        if (body) {
            body.classList.remove('flash-background');
            body.classList.remove('flash-background-long');
        }
        if (titleRow) {
            titleRow.classList.remove('lightning-invert');
            titleRow.classList.remove('lightning-invert-long');
            titleRow.classList.remove('lightning-bright');
            titleRow.classList.remove('lightning-bright-long');
        }
    };

    // Decide random flash pattern: long flashes are single; short flashes follow random burst
    const patternRoll = Math.random();
    const flashes = useLongFlash ? 1 : (patternRoll < 0.5 ? 1 : patternRoll < 0.8 ? 2 : 3);

    let currentTime = 0;
    for (let i = 0; i < flashes; i++) {
        const gap = i === 0 ? 0 : 120 + Math.random() * 140; // 120-260ms gaps
        currentTime += gap;
        setTimeout(() => {
            applyFlash();
            setTimeout(clearFlash, flashDuration); // allow mode-specific fade
        }, currentTime);
    }

    // Final cleanup and icon reset after the last flash
    setTimeout(() => {
        clearFlash();
        updateWeatherIcon(); // Return to appropriate rain/cloud icon (no lightning)
    }, currentTime + flashDuration + 120);
}

// ==================== SLIDER FILL UPDATE ====================
function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const value = parseFloat(slider.value) || 0;
    const percent = ((value - min) / (max - min)) * 100;
    slider.style.setProperty('--slider-percent', `${percent}%`);
}

function initializeAllSliderFills() {
    // Get all range inputs
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        // Initialize fill
        updateSliderFill(slider);
        // Update on input
        slider.addEventListener('input', () => updateSliderFill(slider));
    });
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
    const musicRoomSizeSlider = document.getElementById('musicRoomSize');
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
        if (preset.musicRoomSize !== undefined) {
            musicRoomSizeSlider.value = preset.musicRoomSize;
        }
        rainReverbSlider.value = preset.rainReverb;
        thunderReverbSlider.value = preset.thunderReverb;
    } else if (presetName === 'indoorcozy') {
        // Indoor Cozy: 100% rain, heavy filtering, tiny room with reverb
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        // Keep current music volume - don't override with preset
        musicRoomSizeSlider.value = 0.02; // Very small room
        rainReverbSlider.value = 0.50; // Rain reverb for indoor space
        thunderReverbSlider.value = 0.30; // Thunder reverb for indoor space
        
        // Do NOT auto-play music for Indoor Cozy preset
        
    } else if (presetName === 'outdoor') {
        // Outdoor: 50% rain, open sound, no reverb
        rainVolumeSlider.value = 0.5;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 22050; // Max - no filtering
        // Keep current music volume - don't override with preset
        musicRoomSizeSlider.value = 0.02; // Small room
        rainReverbSlider.value = 0; // No rain reverb
        thunderReverbSlider.value = 0; // No thunder reverb
        
        // Do NOT auto-play music for Outdoor preset
    }
    
    // Trigger all input events to update audio nodes and labels
    rainVolumeSlider.dispatchEvent(new Event('input'));
    thunderVolumeSlider.dispatchEvent(new Event('input'));
    lowpassFilterSlider.dispatchEvent(new Event('input'));
    musicVolumeSlider.dispatchEvent(new Event('input'));
    musicRoomSizeSlider.dispatchEvent(new Event('input'));
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
    
    // Limit concurrent rain sources to prevent mobile audio glitches
    // Mobile devices have limited audio processing power
    const MAX_RAIN_SOURCES = 1;
    if (rainSources.length >= MAX_RAIN_SOURCES) {
        // Still schedule the next layer, but don't create a new source yet
        const duration = rainBuffer.duration;
        const nextLayerDelay = (0.5 + Math.random() * 0.5) * duration * 1000;
        setTimeout(() => {
            startRainLayer();
        }, nextLayerDelay);
        return;
    }
    
    // Create a dedicated gain node for this rain source to enable smooth fade-in
    const rainSourceGain = audioCtx.createGain();
    rainSourceGain.gain.value = 0; // Start at silence
    rainSourceGain.connect(rainGainNode);
    
    const source = audioCtx.createBufferSource();
    source.buffer = rainBuffer;
    source.loop = false; // No loop - we'll manually overlap
    source.connect(rainSourceGain);
    
    const duration = rainBuffer.duration;
    const fadeInTime = 0.05; // 50ms fade-in to prevent clicks
    
    // Start this layer
    source.start(0);
    rainSources.push(source);
    
    // Smooth fade-in envelope to prevent clicks when layers start
    rainSourceGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, fadeInTime);
    
    // Calculate random start time for next layer (between 50% and 100% of duration)
    // This creates natural waves - sometimes layers overlap more, sometimes less
    const nextLayerDelay = (0.5 + Math.random() * 0.5) * duration * 1000;
    
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
            rainSourceGain.disconnect();
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
    
    // Apply current spatial settings to new track
    if (typeof window.applySpatialFromHandle === 'function') {
        window.applySpatialFromHandle();
    }
    
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
        
        if (nextDisplay) {
            nextDisplay.classList.remove('visible');
            nextDisplay.classList.remove('crossfade-active');
        }
    } else {
        if (currentTrackName) {
            currentTrackName.classList.remove('scrolling');
            currentTrackName.innerHTML = '<span>No track loaded</span>';
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
    
    // Apply current spatial settings to new track
    if (typeof window.applySpatialFromHandle === 'function') {
        window.applySpatialFromHandle();
    }
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
        // Update fill visual
        positionSlider.style.setProperty('--track-percent', `${percentage}%`);
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
    
    // On very first manual start, apply Indoor Cozy preset as default
    if (!fromPreset && !hasStartedStormBefore) {
        applyPreset('indoorcozy');
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
    
    // Smooth fade out rain audio (instead of abrupt stop that could cause clicks)
    const rampTime = 0.1;
    rainGainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioCtx.currentTime + rampTime
    );
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
    const musicRoomSizeSlider = document.getElementById('musicRoomSize');
    const rainReverbSlider = document.getElementById('rainReverb');
    const thunderReverbSlider = document.getElementById('thunderReverb');
    
    // Apply Outdoor preset defaults
    rainVolumeSlider.value = 0;
    thunderVolumeSlider.value = 1;
    lowpassFilterSlider.value = 22050;
    
    // Load saved music volume from localStorage, or use default
    const savedMusicVolume = localStorage.getItem('stormgen-music-volume');
    musicVolumeSlider.value = savedMusicVolume !== null ? savedMusicVolume : 100;
    
    musicRoomSizeSlider.value = 0.02;
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
    
    // Labels will be updated by the dispatchEvent calls above
    
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
                musicRoomSize: parseFloat(document.getElementById('musicRoomSize').value),
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
        const targetVolume = parseFloat(rainVolumeSlider.value);
        const rampTime = 0.05; // 50ms ramp for smooth transitions without lag
        rainGainNode.gain.exponentialRampToValueAtTime(
            Math.max(targetVolume, 0.0001), // Avoid zero for exponential ramp
            audioCtx.currentTime + rampTime
        );
        updateBirdsVolume();
        updateWeatherIcon();
    });
    
    // ===== THUNDER VOLUME =====
    
    thunderVolumeSlider.addEventListener('input', () => {
        const targetVolume = parseFloat(thunderVolumeSlider.value);
        const rampTime = 0.05; // 50ms ramp for smooth transitions
        thunderGainNode.gain.exponentialRampToValueAtTime(
            Math.max(targetVolume, 0.0001), // Avoid zero for exponential ramp
            audioCtx.currentTime + rampTime
        );
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
        const rampTime = 0.05; // 50ms ramp for smooth transitions
        lowpassFilterNode.frequency.exponentialRampToValueAtTime(
            cutoff,
            audioCtx.currentTime + rampTime
        );
        
        const min = parseFloat(lowpassFilterSlider.min);
        const max = parseFloat(lowpassFilterSlider.max);
        const boost = 8 * (1 - (cutoff - min) / (max - min));
        rainEQNode.gain.exponentialRampToValueAtTime(
            Math.max(boost, 0.0001),
            audioCtx.currentTime + rampTime
        );
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
            const rampTime = 0.05;
            musicEQBass.gain.exponentialRampToValueAtTime(
                Math.max(Math.pow(10, gain / 20), 0.0001),
                audioCtx.currentTime + rampTime
            );
            if (eqBassLabel) eqBassLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqMidBassSlider) {
        eqMidBassSlider.addEventListener('input', () => {
            const gain = parseFloat(eqMidBassSlider.value);
            const rampTime = 0.05;
            musicEQMidBass.gain.exponentialRampToValueAtTime(
                Math.max(Math.pow(10, gain / 20), 0.0001),
                audioCtx.currentTime + rampTime
            );
            if (eqMidBassLabel) eqMidBassLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqMidSlider) {
        eqMidSlider.addEventListener('input', () => {
            const gain = parseFloat(eqMidSlider.value);
            baseMidEQ = gain; // Update base value
            const rampTime = 0.05;
            
            // Re-apply spatial audio to add the spatial occlusion on top of new base
            if (spatialHandle) {
                const x = parseFloat(spatialHandle.getAttribute('cx'));
                const y = parseFloat(spatialHandle.getAttribute('cy'));
                updateSpatialAudio(x, y);
            } else {
                // If no spatial handle, just update the audio node directly
                musicEQMid.gain.exponentialRampToValueAtTime(
                    Math.max(Math.pow(10, gain / 20), 0.0001),
                    audioCtx.currentTime + rampTime
                );
                if (eqMidLabel) eqMidLabel.textContent = gain.toFixed(1) + ' dB';
            }
        });
    }
    
    if (eqMidTrebleSlider) {
        eqMidTrebleSlider.addEventListener('input', () => {
            const gain = parseFloat(eqMidTrebleSlider.value);
            const rampTime = 0.05;
            musicEQMidTreble.gain.exponentialRampToValueAtTime(
                Math.max(Math.pow(10, gain / 20), 0.0001),
                audioCtx.currentTime + rampTime
            );
            if (eqMidTrebleLabel) eqMidTrebleLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqTrebleSlider) {
        eqTrebleSlider.addEventListener('input', () => {
            const gain = parseFloat(eqTrebleSlider.value);
            const rampTime = 0.05;
            musicEQTreble.gain.exponentialRampToValueAtTime(
                Math.max(Math.pow(10, gain / 20), 0.0001),
                audioCtx.currentTime + rampTime
            );
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
        
        // Update the volume label to show current value
        const musicVolumeLabel = document.getElementById('musicVolumeLabel');
        if (musicVolumeLabel) {
            musicVolumeLabel.textContent = musicVolumeSlider.value;
        }
        
        // Update the CSS variable for the slider fill gradient
        musicVolumeSlider.style.setProperty('--volume-percent', musicVolumeSlider.value + '%');
        
        // If crossfading, don't override gain values - the crossfade interval manages them
        if (isCrossfading) {
            // Just store the target volume, the crossfade will use it
            // Don't directly set gain values during crossfade
        } else {
            // Update user music gain node if it exists (only when not crossfading)
            if (userMusicGain) {
                const rampTime = 0.05;
                userMusicGain.gain.exponentialRampToValueAtTime(
                    Math.max(volume, 0.0001),
                    audioCtx.currentTime + rampTime
                );
            }
        }
        
        // Update default music volume with smooth ramping
        if (defaultMusicAudio) {
            // Store interval ID if we need to clear it
            if (defaultMusicAudio._volumeRampInterval) {
                clearInterval(defaultMusicAudio._volumeRampInterval);
            }
            
            const rampSteps = 10;
            const startVolume = defaultMusicAudio.volume;
            const diff = volume - startVolume;
            let step = 0;
            
            defaultMusicAudio._volumeRampInterval = setInterval(() => {
                step++;
                const progress = step / rampSteps;
                defaultMusicAudio.volume = startVolume + (diff * progress);
                if (step >= rampSteps) {
                    clearInterval(defaultMusicAudio._volumeRampInterval);
                    defaultMusicAudio.volume = volume;
                }
            }, 5);
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
        
        // Save music volume to localStorage
        localStorage.setItem('stormgen-music-volume', musicVolumeSlider.value);
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
            // Save music volume to localStorage
            localStorage.setItem('stormgen-music-volume', value);
        });
    }
    
    const musicReverbLabel = document.getElementById('musicReverbLabel');

    function setReverbBassBoost(mix, filterNode, maxDb) {
        const clamped = Math.min(Math.max(mix, 0), 1);
        const targetGain = clamped * maxDb;
        const rampTime = 0.05;
        filterNode.gain.exponentialRampToValueAtTime(
            Math.max(targetGain, 0.0001),
            audioCtx.currentTime + rampTime
        );
    }

    function updateMusicReverbMix(mix, fromSpatial = false) {
        const clamped = Math.min(Math.max(mix, 0), 1);
        
        // Use equal-power crossfade to maintain perceived loudness
        // This prevents volume drop when reverb is applied
        const wetGain = Math.sin(clamped * Math.PI / 2);  // 0 to 1 (curved)
        const dryGain = Math.cos(clamped * Math.PI / 2);  // 1 to 0 (curved)
        
        // Apply a makeup gain to compensate for the crossfade curve
        // This keeps the overall loudness more consistent
        const makeupGain = 1.0 + (clamped * 0.3); // Boost up to 30% when reverb is high
        
        // Smooth reverb mix transitions to prevent abrupt changes
        musicWetGain.gain.setTargetAtTime(wetGain * makeupGain, audioCtx.currentTime, 0.02);
        musicDryGain.gain.setTargetAtTime(dryGain * makeupGain, audioCtx.currentTime, 0.02);
        
        if (musicReverbLabel) {
            musicReverbLabel.textContent = clamped.toFixed(2);
        }
        setReverbBassBoost(clamped, musicReverbBass, 10); // Increased from 7 to 10 dB for more bass presence in reverb when behind
        
        // Update baseMusicReverb when set from spatial controller
        if (fromSpatial) {
            baseMusicReverb = clamped;
        }
    }
    
    const rainReverbLabel = document.getElementById('rainReverbLabel');
    
    rainReverbSlider.addEventListener('input', () => {
        const mix = parseFloat(rainReverbSlider.value);
        const rampTime = 0.05;
        rainWetGain.gain.exponentialRampToValueAtTime(
            Math.max(mix, 0.0001),
            audioCtx.currentTime + rampTime
        );
        rainDryGain.gain.exponentialRampToValueAtTime(
            Math.max(1 - mix, 0.0001),
            audioCtx.currentTime + rampTime
        );
        rainReverbLabel.textContent = mix.toFixed(2);
        setReverbBassBoost(mix, rainReverbBass, 6);
    });
    
    const thunderReverbLabel = document.getElementById('thunderReverbLabel');
    
    thunderReverbSlider.addEventListener('input', () => {
        const mix = parseFloat(thunderReverbSlider.value);
        const rampTime = 0.05;
        thunderWetGain.gain.exponentialRampToValueAtTime(
            Math.max(mix, 0.0001),
            audioCtx.currentTime + rampTime
        );
        thunderDryGain.gain.exponentialRampToValueAtTime(
            Math.max(1 - mix, 0.0001),
            audioCtx.currentTime + rampTime
        );
        thunderReverbLabel.textContent = mix.toFixed(2);
        setReverbBassBoost(mix, thunderReverbBass, 12);
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
        musicRoomSizeLabel.textContent = sliderValue.toFixed(3);
    });
    
    // ===== 3D SPATIAL AUDIO CONTROLLER =====
    const spatialHandle = document.getElementById('spatial-handle');
    const spatialHandleInner = document.querySelector('.spatial-handle-inner');
    const spatialSVG = document.getElementById('spatial-controller-svg');
    const spatialPanValue = document.getElementById('spatialPanValue');
    const spatialFilterValue = document.getElementById('spatialFilterValue');
    const popupMenu = document.getElementById('spatial-popup-menu');
    const snapZone = document.getElementById('headphone-snap-zone');
    
    let isDragging = false;
    let wasRecentlyDragging = false;
    let menuVisible = false;
    const centerX = 100;
    const centerY = 100;
    const radius = 85;
    
    // ===== SPATIAL CONTROLLER DEFAULT POSITIONS =====
    const APP_DEFAULT_X = 100;
    const APP_DEFAULT_Y = 57.5; // Front of listener
    
    // Headphone mode state and snap zone
    let isHeadphoneMode = true;
    const HEADPHONE_SNAP_RADIUS = 6; // Snap zone radius around center (smaller, always visible)
    
    // Load saved custom default or use app default
    let savedDefaultX = parseFloat(localStorage.getItem('stormgen-spatial-default-x')) || APP_DEFAULT_X;
    let savedDefaultY = parseFloat(localStorage.getItem('stormgen-spatial-default-y')) || APP_DEFAULT_Y;
    
    // Load headphone mode state
    isHeadphoneMode = localStorage.getItem('stormgen-headphone-mode') === 'true';
    
    // Update spatial audio based on handle position - TOP-DOWN HEAD VIEW
    // SVG circle = horizontal plane around listener's head
    // Center = inside listener's head, Front (top) = listener's face, Back (bottom) = behind head
    function updateSpatialAudio(x, y) {
        // ===== HEADPHONE MODE (Center Snap Zone) =====
        // If in headphone mode, bypass all spatial effects - pure stereo listening
        if (isHeadphoneMode) {
            // Reset to neutral: center pan, no reverb, full volume
            musicPannerNode.pan.setTargetAtTime(0, audioCtx.currentTime, 0.02);
            
            const baseVolume = parseFloat(document.getElementById('musicVolume').value) / 100;
            if (userMusicGain) {
                userMusicGain.gain.setTargetAtTime(baseVolume, audioCtx.currentTime, 0.02);
            }
            if (defaultMusicAudio) {
                defaultMusicAudio.volume = baseVolume;
            }
            
            // Bypass reverb completely - set to 0 (no spatial reverb in headphone mode)
            updateMusicReverbMix(0, false);
            
            // Reset lowpass filter to full frequency (no head shadow)
            spatialDryLowpass.frequency.setTargetAtTime(22050, audioCtx.currentTime, 0.02);
            
            // Reset bass shelf boost
            spatialDryBassShelf.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
            
            // Reset EQ to base
            musicEQMid.gain.setTargetAtTime(baseMidEQ, audioCtx.currentTime, 0.02);
            if (eqMidLabel) {
                eqMidLabel.textContent = baseMidEQ.toFixed(1) + ' dB';
            }
            
            // Update UI
            spatialPanValue.textContent = '🎧 Headphone Mode';
            spatialFilterValue.textContent = 'Centered';
            return; // Skip all spatial calculations
        }
        
        // Calculate distance from center (listener's head position)
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        const normalizedDistance = Math.min(1, distanceFromCenter / radius); // 0 at center, 1 at edge
        
        // ===== DETERMINE FRONT vs BACK (for panning inversion) =====
        // Y position: top (0) = front face, bottom (200) = back of head
        // normalizedY: -1 at front, +1 at back
        const normalizedY = (y - centerY) / radius;
        // X position: left (0) = left side, right (200) = right side
        // normalizedX: -1 at left, +1 at right
        const normalizedX = (x - centerX) / radius;
        // Determine which half: front (-1 to 0) or back (0 to +1)
        const isBack = normalizedY > 0; // If positive Y, sound is coming from back
        const backAmount = Math.max(0, normalizedY); // 0 at center/front, 1 at back
        const frontAmount = Math.max(0, -normalizedY); // 1 at front, 0 at center/back
        
        // ===== STEREO SPEAKER PANNING (Speaker always points at listener) =====
        // The dot is a stereo speaker with left and right drivers
        // It always points toward the listener (at center)
        // As it rotates around the listener, which channel faces the listener changes
        
        // Calculate angle from listener (center) to speaker (dot)
        const angle = Math.atan2(dy, dx); // -PI to PI
        // 0 = right, PI/2 = down(back), PI/-PI = left, -PI/2 = up(front)
        
        // Panning based on speaker's horizontal position (left-right axis from listener's perspective)
        // Use cosine: right (0°) = +1, left (180°) = -1, top/bottom (±90°) = 0
        let pan = Math.cos(angle);
        
        // Apply a gentler curve for more gradual panning - larger center zone
        // Use power greater than 1 to compress values toward center (2.5 keeps center zone large)
        const sign = pan < 0 ? -1 : 1;
        pan = sign * Math.pow(Math.abs(pan), 2.5);
        
        // Clamp to valid range
        pan = Math.max(-1, Math.min(1, pan));
        
        // Smooth panning transitions to prevent sharp flips when crossing center
        // Use setTargetAtTime for exponential smoothing - feels natural for continuous movement
        musicPannerNode.pan.setTargetAtTime(pan, audioCtx.currentTime, 0.02);
        
        // ===== ROOM ACOUSTIC CONTEXT =====
        const roomSize = parseFloat(document.getElementById('musicRoomSize').value); // 0.001 to 0.1
        const roomSizeFactor = (0.1 - Math.min(roomSize, 0.1)) / 0.1; // 0=large room, 1=small room
        
        // ===== REALISTIC DISTANCE ATTENUATION =====
        // Center = full volume, edges = quieter but still clearly audible
        // In rooms, reflections mean you always hear the source
        const roomInfluence = roomSizeFactor * 0.3; // Small rooms reduce distance penalty
        const effectiveAttenuation = normalizedDistance * (0.02 - roomInfluence); // Minimal attenuation - almost none
        
        const baseMinVolume = 1.0; // Always at full volume
        const roomBoostMin = 0; // No boost needed
        
        // Front of head has less distance attenuation than back due to head blocking
        // frontAmount: 1 = directly in front, 0 = directly behind
        const frontBackAttenuationFactor = 1.0; // No variation front to back
        const minVolumeScale = baseMinVolume;
        
        const volumeScale = 1 - (effectiveAttenuation * (1 - minVolumeScale));
        
        // ===== MID-SIDE DIRECTIONAL PRESENCE REDUCTION =====
        // When audio is behind listener, the head blocks direct sound (mid/mono information)
        // Head shadow reduces presence more than room reflections (side/stereo information)
        // This simulates realistic head-related transfer function (HRTF) behavior
        // NOTE: Keep at 1.0 (no volume reduction) - volume should stay consistent as handle moves
        const midReduction = 1.0;
        
        // Apply volume attenuation with smoothing to prevent clicks
        const baseVolume = parseFloat(document.getElementById('musicVolume').value) / 100;
        const targetVolume = baseVolume * volumeScale * midReduction;
        
        if (userMusicGain) {
            userMusicGain.gain.setTargetAtTime(targetVolume, audioCtx.currentTime, 0.02);
        }
        if (defaultMusicAudio) {
            // HTMLAudioElement doesn't have automation, but volume changes are naturally smoothed by browser
            defaultMusicAudio.volume = targetVolume;
        }
        
        // ===== REVERB/DISTANCE PERCEPTION =====
        // You're always in a room with ambient reflections - reverb never drops to zero
        // In a SMALL room: reflections bounce everywhere, high reverb baseline
        // In a LARGE room: fewer reflections, lower reverb baseline
        // Close sources: more direct sound, but still hear room reflections
        // Distant sources: more reverb-dominated, less direct sound
        
        // Base room ambience - highly dependent on room size
        // Large room (factor=0) = 0.10 baseline reverb (sparse reflections)
        // Small room (factor=1) = 0.50 baseline reverb (dense reflections)
        // Reduced from previous (0.15 to 0.75) to give more control at close distances
        const baselineRoomReverb = 0.10 + (roomSizeFactor * 0.4);
        
        // Reverb increases when sound is behind listener to create distance perception
        // When sound is blocked by head (behind), more ambient reflections are audible vs direct sound
        // Only apply spatial reverb when NOT in headphone mode (to preserve user's preference when switching songs)
        let spatialReverb;
        if (isHeadphoneMode) {
            // In headphone mode: reverb is off
            spatialReverb = 0;
        } else {
            // In spatial mode: subtle reverb increase when behind listener
            // Keep reverb as the main spatial cue - other effects should be minimal
            let distanceReverb = 0;
            if (normalizedY > 0.15) {
                // Very gradual reverb increase - the main spatial indicator
                const behindProgress = (normalizedY - 0.15) / 0.85;
                const taperCurve = Math.pow(behindProgress, 0.75);
                distanceReverb = taperCurve * 0.08; // Very subtle - just 0.08 max
            }
            spatialReverb = Math.min(0.85, Math.max(0.05, baselineRoomReverb + distanceReverb));
        }
        updateMusicReverbMix(spatialReverb, true);
        
        // ===== HEAD SHADOW LOWPASS FILTER =====
        // Very subtle high-frequency roll-off when behind - almost imperceptible
        let lowpassFreq;
        
        if (normalizedY < -0.4) {
            // Well in front: no filtering
            lowpassFreq = 22050;
        } else if (normalizedY > 0.4) {
            // Well behind: very gentle roll-off (from 22050 to 8000 Hz is much subtler)
            lowpassFreq = 8000;
        } else {
            // Gradual transition
            const t = (normalizedY + 0.4) / 0.8;
            const smoothedT = t * t * (3 - 2 * t);
            lowpassFreq = 22050 - (smoothedT * (22050 - 8000));
        }
        
        // Apply lowpass to ONLY dry path (reverb stays bright)
        spatialDryLowpass.frequency.setTargetAtTime(lowpassFreq, audioCtx.currentTime, 0.05);
        
        // ===== SCOOPED SOUND WHEN BEHIND (Bass boost for U-shaped EQ) =====
        // Minimal bass boost - keep it subtle so it doesn't interfere with spinning effect
        let bassBoostGain = 0; 
        if (normalizedY > 0.15) {
            const behindProgress = (normalizedY - 0.15) / 0.85;
            const taperCurve = Math.pow(behindProgress, 0.75);
            bassBoostGain = taperCurve * 1.5; // Very subtle - just 1.5 dB max
        }
        spatialDryBassShelf.gain.setTargetAtTime(bassBoostGain, audioCtx.currentTime, 0.05);
        
        // ===== MID-RANGE REDUCTION FOR HEAD SHADOW EFFECT =====
        // When sound is behind listener, reduce the presence region (500-2000 Hz)
        // This is applied to the FULL stereo signal based on spatial Y position (behind)
        // Not based on stereo channel - preserves stereo width while removing centered info
        let midRangeGain = 0; // Start at 0 dB (no reduction) when in front
        
        if (normalizedY > 0.15) {
            // Progressively reduce mid-range as sound moves behind
            const behindProgress = (normalizedY - 0.15) / 0.85;
            const taperCurve = Math.pow(behindProgress, 0.75);
            // Reduce mid-range from 0 dB to -12 dB at back
            // This removes presence/voice information while keeping bass and reflections
            midRangeGain = -(taperCurve * 12.0);
        }
        
        // Apply mid-range filter gain - affects both stereo channels equally
        midRangeFilter.gain.setTargetAtTime(midRangeGain, audioCtx.currentTime, 0.05);
        
        // ===== UPDATE UI INDICATORS =====
        // Pan indicator with directional awareness
        let panDesc = '';
        if (Math.abs(normalizedX) < 0.5) {
            panDesc = 'Center';
        } else if (normalizedX < 0) {
            panDesc = `Left ${Math.abs(normalizedX * 100).toFixed(0)}%`;
        } else {
            panDesc = `Right ${(normalizedX * 100).toFixed(0)}%`;
        }
        
        // Add front/back directional hint
        if (Math.abs(normalizedY) < 0.2) {
            panDesc += ' (Side)';
        } else if (normalizedY < -0.2) {
            panDesc += ' (Front)';
        } else if (normalizedY > 0.2) {
            panDesc += ' (Back)';
        }
        
        spatialPanValue.textContent = panDesc;
        
        // Distance/reverb indicator
        const distancePercent = (normalizedDistance * 100).toFixed(0);
        spatialFilterValue.textContent = `Distance: ${distancePercent}%`;
    }
    
    window.applySpatialFromHandle = function applySpatialFromHandle() {
        if (!spatialHandle) return;
        const x = parseFloat(spatialHandle.getAttribute('cx'));
        const y = parseFloat(spatialHandle.getAttribute('cy'));
        const safeX = Number.isFinite(x) ? x : savedDefaultX;
        const safeY = Number.isFinite(y) ? y : savedDefaultY;
        updateSpatialAudio(safeX, safeY);
    };
    
    // Constrain handle to circle boundary
    function constrainToCircle(x, y) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > radius) {
            const angle = Math.atan2(dy, dx);
            return {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            };
        }
        return { x, y };
    }
    
    // Get mouse/touch position relative to SVG
    function getPosition(evt) {
        const rect = spatialSVG.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        
        // Get the SVG's viewBox dimensions (0 0 200 200)
        const svgRect = spatialSVG.viewBox.baseVal || spatialSVG.getBBox();
        
        // Convert client coordinates to SVG coordinates using the actual SVG dimensions
        const x = ((clientX - rect.left) / rect.width) * 200;
        const y = ((clientY - rect.top) / rect.height) * 200;
        
        return constrainToCircle(x, y);
    }
    
    // Mouse/touch event handlers
    function startDragging(evt) {
        isDragging = true;
        evt.preventDefault();
        
        // Temporarily pause auto-rotation during drag (will resume on release)
        if (isAutoRotating && autoRotateAnimationId) {
            cancelAnimationFrame(autoRotateAnimationId);
            autoRotateAnimationId = null;
        }
        
        // If auto-rotation is active, allow adjusting but don't disable headphone mode
        if (!isAutoRotating) {
            // Only disable headphone mode when not auto-rotating
            if (isHeadphoneMode) {
                isHeadphoneMode = false;
                spatialHandle.classList.remove('headphone-mode');
                spatialHandleInner.classList.remove('headphone-mode');
            }
        }
        
        const pos = getPosition(evt);
        spatialHandle.setAttribute('cx', pos.x);
        spatialHandle.setAttribute('cy', pos.y);
        spatialHandleInner.setAttribute('cx', pos.x);
        spatialHandleInner.setAttribute('cy', pos.y);
        updateSpatialAudio(pos.x, pos.y);
    }
    
    function drag(evt) {
        if (!isDragging) return;
        evt.preventDefault();
        const pos = getPosition(evt);
        
        // Always update handle position during drag (even if auto-rotating)
        spatialHandle.setAttribute('cx', pos.x);
        spatialHandle.setAttribute('cy', pos.y);
        spatialHandleInner.setAttribute('cx', pos.x);
        spatialHandleInner.setAttribute('cy', pos.y);
        updateSpatialAudio(pos.x, pos.y);
        
        // Update popup menu position to follow handle
        updatePopupPosition(pos.x, pos.y);
    }
    
    function stopDragging() {
        if (!isDragging) return;
        isDragging = false;
        wasRecentlyDragging = true;
        
        // Reset flag after a short delay
        setTimeout(() => {
            wasRecentlyDragging = false;
        }, 200);
        
        const handleX = parseFloat(spatialHandle.getAttribute('cx'));
        const handleY = parseFloat(spatialHandle.getAttribute('cy'));
        const dx = handleX - centerX;
        const dy = handleY - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        // If auto-rotation is active, resume from new position
        if (isAutoRotating) {
            // Update angle and radius to new position
            autoRotateAngle = Math.atan2(dy, dx) * (180 / Math.PI);
            autoRotateRadius = distFromCenter;
            // Resume animation
            autoRotateFrame();
            return;
        }
        
        // Check if handle was dropped in headphone snap zone (center circle)
        
        if (distFromCenter <= HEADPHONE_SNAP_RADIUS) {
            // Snap to center and enable headphone mode
            isHeadphoneMode = true;
            spatialHandle.setAttribute('cx', centerX);
            spatialHandle.setAttribute('cy', centerY);
            spatialHandleInner.setAttribute('cx', centerX);
            spatialHandleInner.setAttribute('cy', centerY);
            localStorage.setItem('stormgen-headphone-mode', 'true');
            localStorage.setItem('stormgen-spatial-x', centerX);
            localStorage.setItem('stormgen-spatial-y', centerY);
            
            // Add visual feedback
            spatialHandle.classList.add('headphone-mode');
            spatialHandleInner.classList.add('headphone-mode');
            
            updateSpatialAudio(centerX, centerY);
        } else {
            // Outside snap zone - save position and disable headphone mode if it was active
            localStorage.setItem('stormgen-spatial-x', handleX);
            localStorage.setItem('stormgen-spatial-y', handleY);
            
            if (isHeadphoneMode) {
                isHeadphoneMode = false;
                localStorage.setItem('stormgen-headphone-mode', 'false');
                spatialHandle.classList.remove('headphone-mode');
                spatialHandleInner.classList.remove('headphone-mode');
                updateSpatialAudio(handleX, handleY);
            }
        }
    }
    
    // ===== POPUP MENU FUNCTIONALITY =====
    
    // Update popup menu position relative to handle
    function updatePopupPosition(handleX, handleY) {
        const rect = spatialSVG.getBoundingClientRect();
        const x = ((handleX / 200) * rect.width) + rect.left;
        const y = ((handleY / 200) * rect.height) + rect.top;
        
        popupMenu.style.left = x + 'px';
        popupMenu.style.top = (y - 30) + 'px'; // Position above handle
    }
    
    // Show/hide popup based on mouse proximity to handle
    spatialSVG.addEventListener('mousemove', (evt) => {
        if (isDragging) return;
        
        const rect = spatialSVG.getBoundingClientRect();
        const mouseX = ((evt.clientX - rect.left) / rect.width) * 200;
        const mouseY = ((evt.clientY - rect.top) / rect.height) * 200;
        
        const handleX = parseFloat(spatialHandle.getAttribute('cx'));
        const handleY = parseFloat(spatialHandle.getAttribute('cy'));
        
        const dx = mouseX - handleX;
        const dy = mouseY - handleY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 20) {
            if (!menuVisible) {
                menuVisible = true;
                popupMenu.classList.add('visible');
                updatePopupPosition(handleX, handleY);
            }
        } else if (distance > 30) {
            if (menuVisible) {
                menuVisible = false;
                popupMenu.classList.remove('visible');
            }
        }
    });
    
    // Hide menu when mouse leaves SVG area
    spatialSVG.addEventListener('mouseleave', () => {
        menuVisible = false;
        popupMenu.classList.remove('visible');
    });
    
    // Keep menu visible when hovering over it
    popupMenu.addEventListener('mouseenter', () => {
        menuVisible = true;
        popupMenu.classList.add('visible');
    });
    
    popupMenu.addEventListener('mouseleave', () => {
        menuVisible = false;
        popupMenu.classList.remove('visible');
    });
    
    // Popup button handlers
    document.getElementById('popup-reset')?.addEventListener('click', () => {
        spatialHandle.setAttribute('cx', savedDefaultX);
        spatialHandle.setAttribute('cy', savedDefaultY);
        spatialHandleInner.setAttribute('cx', savedDefaultX);
        spatialHandleInner.setAttribute('cy', savedDefaultY);
        
        // Check if reset position is within headphone snap zone
        const dx = savedDefaultX - centerX;
        const dy = savedDefaultY - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (distFromCenter <= HEADPHONE_SNAP_RADIUS) {
            // Enable headphone mode if within snap radius
            if (!isHeadphoneMode) {
                isHeadphoneMode = true;
                spatialHandle.classList.add('headphone-mode');
                spatialHandleInner.classList.add('headphone-mode');
                localStorage.setItem('stormgen-headphone-mode', 'true');
            }
        } else {
            // Disable headphone mode if outside snap radius
            if (isHeadphoneMode) {
                isHeadphoneMode = false;
                spatialHandle.classList.remove('headphone-mode');
                spatialHandleInner.classList.remove('headphone-mode');
                localStorage.setItem('stormgen-headphone-mode', 'false');
            }
        }
        
        updateSpatialAudio(savedDefaultX, savedDefaultY);
        updatePopupPosition(savedDefaultX, savedDefaultY);
        localStorage.setItem('stormgen-spatial-x', savedDefaultX);
        localStorage.setItem('stormgen-spatial-y', savedDefaultY);
    });
    
    document.getElementById('popup-save')?.addEventListener('click', () => {
        const x = parseFloat(spatialHandle.getAttribute('cx'));
        const y = parseFloat(spatialHandle.getAttribute('cy'));
        savedDefaultX = x;
        savedDefaultY = y;
        localStorage.setItem('stormgen-spatial-default-x', x);
        localStorage.setItem('stormgen-spatial-default-y', y);
    });
    
    document.getElementById('popup-app-default')?.addEventListener('click', () => {
        savedDefaultX = APP_DEFAULT_X;
        savedDefaultY = APP_DEFAULT_Y;
        localStorage.setItem('stormgen-spatial-default-x', APP_DEFAULT_X);
        localStorage.setItem('stormgen-spatial-default-y', APP_DEFAULT_Y);
        
        spatialHandle.setAttribute('cx', APP_DEFAULT_X);
        spatialHandle.setAttribute('cy', APP_DEFAULT_Y);
        spatialHandleInner.setAttribute('cx', APP_DEFAULT_X);
        spatialHandleInner.setAttribute('cy', APP_DEFAULT_Y);
        
        // Check if app default position is within headphone snap zone
        const dx = APP_DEFAULT_X - centerX;
        const dy = APP_DEFAULT_Y - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (distFromCenter <= HEADPHONE_SNAP_RADIUS) {
            // Enable headphone mode if within snap radius
            if (!isHeadphoneMode) {
                isHeadphoneMode = true;
                spatialHandle.classList.add('headphone-mode');
                spatialHandleInner.classList.add('headphone-mode');
                localStorage.setItem('stormgen-headphone-mode', 'true');
            }
        } else {
            // Disable headphone mode if outside snap radius
            if (isHeadphoneMode) {
                isHeadphoneMode = false;
                spatialHandle.classList.remove('headphone-mode');
                spatialHandleInner.classList.remove('headphone-mode');
                localStorage.setItem('stormgen-headphone-mode', 'false');
            }
        }
        
        updateSpatialAudio(APP_DEFAULT_X, APP_DEFAULT_Y);
        updatePopupPosition(APP_DEFAULT_X, APP_DEFAULT_Y);
        localStorage.setItem('stormgen-spatial-x', APP_DEFAULT_X);
        localStorage.setItem('stormgen-spatial-y', APP_DEFAULT_Y);
    });
    
    // Auto-rotate functionality
    let isAutoRotating = false;
    let autoRotateAnimationId = null;
    let autoRotateAngle = 0;
    let autoRotateRadius = 42.5; // Current distance from center (adjustable by user)
    let autoRotateSpeed = 0.5; // degrees per frame (adjustable by user)
    
    const autoRotateBtn = document.getElementById('spatial-auto-rotate');
    
    function autoRotateFrame() {
        if (!isAutoRotating) return;
        
        // Increment angle
        autoRotateAngle += autoRotateSpeed;
        if (autoRotateAngle >= 360) autoRotateAngle -= 360;
        
        // Convert angle to radians (0° = right, 90° = down, etc.)
        const radians = (autoRotateAngle * Math.PI) / 180;
        
        // Calculate position on circle using current radius
        const x = centerX + Math.cos(radians) * autoRotateRadius;
        const y = centerY + Math.sin(radians) * autoRotateRadius;
        
        // Update handle position
        spatialHandle.setAttribute('cx', x);
        spatialHandle.setAttribute('cy', y);
        spatialHandleInner.setAttribute('cx', x);
        spatialHandleInner.setAttribute('cy', y);
        
        // Disable headphone mode during auto-rotation
        if (isHeadphoneMode) {
            isHeadphoneMode = false;
            spatialHandle.classList.remove('headphone-mode');
            spatialHandleInner.classList.remove('headphone-mode');
            localStorage.setItem('stormgen-headphone-mode', 'false');
        }
        
        // Update audio
        updateSpatialAudio(x, y);
        
        // Continue animation
        autoRotateAnimationId = requestAnimationFrame(autoRotateFrame);
    }
    
    autoRotateBtn?.addEventListener('click', () => {
        isAutoRotating = !isAutoRotating;
        
        if (isAutoRotating) {
            // Start rotation from current position, maintaining current distance
            const currentX = parseFloat(spatialHandle.getAttribute('cx'));
            const currentY = parseFloat(spatialHandle.getAttribute('cy'));
            const dx = currentX - centerX;
            const dy = currentY - centerY;
            autoRotateAngle = Math.atan2(dy, dx) * (180 / Math.PI);
            autoRotateRadius = Math.sqrt(dx * dx + dy * dy); // Capture current distance
            
            autoRotateBtn.classList.add('active');
            autoRotateBtn.textContent = '⏸ Stop';
            autoRotateFrame();
        } else {
            // Stop rotation
            autoRotateBtn.classList.remove('active');
            autoRotateBtn.textContent = '⭮ Auto';
            if (autoRotateAnimationId) {
                cancelAnimationFrame(autoRotateAnimationId);
                autoRotateAnimationId = null;
            }
        }
    });
    
    // Auto-rotate speed control
    const autoRotateSpeedSlider = document.getElementById('autoRotateSpeed');
    const autoRotateSpeedLabel = document.getElementById('autoRotateSpeedLabel');
    
    // Initialize autoRotateSpeed from slider's current value
    if (autoRotateSpeedSlider) {
        autoRotateSpeed = parseFloat(autoRotateSpeedSlider.value);
    }
    
    autoRotateSpeedSlider?.addEventListener('input', () => {
        autoRotateSpeed = parseFloat(autoRotateSpeedSlider.value);
        if (autoRotateSpeedLabel) {
            autoRotateSpeedLabel.textContent = autoRotateSpeed.toFixed(1) + '×';
        }
    });
    
    // Add event listeners for mouse
    spatialHandle.addEventListener('mousedown', startDragging);
    spatialSVG.addEventListener('mousedown', startDragging);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDragging);
    
    // Add event listeners for touch
    spatialHandle.addEventListener('touchstart', startDragging);
    spatialSVG.addEventListener('touchstart', startDragging);
    window.addEventListener('touchmove', drag);
    window.addEventListener('touchend', stopDragging);
    
    // ===== SPATIAL CONTROLLER RESET/SAVE FUNCTIONALITY =====
    const resetBtn = document.getElementById('resetSpatialBtn');
    const savDefaultBtn = document.getElementById('saveSpatialDefaultBtn');
    const resetAppDefaultBtn = document.getElementById('resetToAppDefaultBtn');
    
    // Reset button: restore to saved default position
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            spatialHandle.setAttribute('cx', savedDefaultX);
            spatialHandle.setAttribute('cy', savedDefaultY);
            spatialHandleInner.setAttribute('cx', savedDefaultX);
            spatialHandleInner.setAttribute('cy', savedDefaultY);
            
            // Check if reset position is within headphone snap zone
            const dx = savedDefaultX - centerX;
            const dy = savedDefaultY - centerY;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            
            if (distFromCenter <= HEADPHONE_SNAP_RADIUS) {
                // Enable headphone mode if within snap radius
                if (!isHeadphoneMode) {
                    isHeadphoneMode = true;
                    spatialHandle.classList.add('headphone-mode');
                    spatialHandleInner.classList.add('headphone-mode');
                    localStorage.setItem('stormgen-headphone-mode', 'true');
                }
            } else {
                // Disable headphone mode if outside snap radius
                if (isHeadphoneMode) {
                    isHeadphoneMode = false;
                    spatialHandle.classList.remove('headphone-mode');
                    spatialHandleInner.classList.remove('headphone-mode');
                    localStorage.setItem('stormgen-headphone-mode', 'false');
                }
            }
            
            updateSpatialAudio(savedDefaultX, savedDefaultY);
            localStorage.setItem('stormgen-spatial-x', savedDefaultX);
            localStorage.setItem('stormgen-spatial-y', savedDefaultY);
        });
    }
    
    // Save current position as new default
    if (savDefaultBtn) {
        savDefaultBtn.addEventListener('click', () => {
            const x = parseFloat(spatialHandle.getAttribute('cx'));
            const y = parseFloat(spatialHandle.getAttribute('cy'));
            savedDefaultX = x;
            savedDefaultY = y;
            localStorage.setItem('stormgen-spatial-default-x', x);
            localStorage.setItem('stormgen-spatial-default-y', y);
            // Visual feedback
            savDefaultBtn.style.opacity = '0.5';
            setTimeout(() => {
                savDefaultBtn.style.opacity = '1';
            }, 200);
        });
    }
    
    // Reset to app's original default
    if (resetAppDefaultBtn) {
        resetAppDefaultBtn.addEventListener('click', () => {
            savedDefaultX = APP_DEFAULT_X;
            savedDefaultY = APP_DEFAULT_Y;
            localStorage.setItem('stormgen-spatial-default-x', APP_DEFAULT_X);
            localStorage.setItem('stormgen-spatial-default-y', APP_DEFAULT_Y);
            
            spatialHandle.setAttribute('cx', APP_DEFAULT_X);
            spatialHandle.setAttribute('cy', APP_DEFAULT_Y);
            spatialHandleInner.setAttribute('cx', APP_DEFAULT_X);
            spatialHandleInner.setAttribute('cy', APP_DEFAULT_Y);
            
            // Check if app default position is within headphone snap zone
            const dx = APP_DEFAULT_X - centerX;
            const dy = APP_DEFAULT_Y - centerY;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            
            if (distFromCenter <= HEADPHONE_SNAP_RADIUS) {
                // Enable headphone mode if within snap radius
                if (!isHeadphoneMode) {
                    isHeadphoneMode = true;
                    spatialHandle.classList.add('headphone-mode');
                    spatialHandleInner.classList.add('headphone-mode');
                    localStorage.setItem('stormgen-headphone-mode', 'true');
                }
            } else {
                // Disable headphone mode if outside snap radius
                if (isHeadphoneMode) {
                    isHeadphoneMode = false;
                    spatialHandle.classList.remove('headphone-mode');
                    spatialHandleInner.classList.remove('headphone-mode');
                    localStorage.setItem('stormgen-headphone-mode', 'false');
                }
            }
            
            updateSpatialAudio(APP_DEFAULT_X, APP_DEFAULT_Y);
            localStorage.setItem('stormgen-spatial-x', APP_DEFAULT_X);
            localStorage.setItem('stormgen-spatial-y', APP_DEFAULT_Y);
        });
    }
    
    // Double-click spatial controller to reset
    spatialSVG.addEventListener('dblclick', () => {
        spatialHandle.setAttribute('cx', savedDefaultX);
        spatialHandle.setAttribute('cy', savedDefaultY);
        spatialHandleInner.setAttribute('cx', savedDefaultX);
        spatialHandleInner.setAttribute('cy', savedDefaultY);
        
        // Check if reset position is within headphone snap zone
        const dx = savedDefaultX - centerX;
        const dy = savedDefaultY - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (distFromCenter <= HEADPHONE_SNAP_RADIUS) {
            // Enable headphone mode if within snap radius
            if (!isHeadphoneMode) {
                isHeadphoneMode = true;
                spatialHandle.classList.add('headphone-mode');
                spatialHandleInner.classList.add('headphone-mode');
                localStorage.setItem('stormgen-headphone-mode', 'true');
            }
        } else {
            // Disable headphone mode if outside snap radius
            if (isHeadphoneMode) {
                isHeadphoneMode = false;
                spatialHandle.classList.remove('headphone-mode');
                spatialHandleInner.classList.remove('headphone-mode');
                localStorage.setItem('stormgen-headphone-mode', 'false');
            }
        }
        
        updateSpatialAudio(savedDefaultX, savedDefaultY);
        localStorage.setItem('stormgen-spatial-x', savedDefaultX);
        localStorage.setItem('stormgen-spatial-y', savedDefaultY);
    });
    
    // Right-click spatial controller to save as default
    spatialSVG.addEventListener('contextmenu', (evt) => {
        evt.preventDefault();
        const x = parseFloat(spatialHandle.getAttribute('cx'));
        const y = parseFloat(spatialHandle.getAttribute('cy'));
        savedDefaultX = x;
        savedDefaultY = y;
        localStorage.setItem('stormgen-spatial-default-x', x);
        localStorage.setItem('stormgen-spatial-default-y', y);
        // Visual feedback
        if (savDefaultBtn) {
            savDefaultBtn.style.opacity = '0.5';
            setTimeout(() => {
                savDefaultBtn.style.opacity = '1';
            }, 200);
        }
    });
    
    // Occlusion slider removed: occlusion strength now driven purely by vertical position
    
    // Initialize: sync base values with current sliders before first update
    if (eqMidSlider) {
        baseMidEQ = parseFloat(eqMidSlider.value);
    }
    // baseMusicReverb is initialized to 0 - spatial controller now fully controls reverb mix
    
    // Initialize position: restore from localStorage if available and valid, otherwise use saved default
    let initX = parseFloat(localStorage.getItem('stormgen-spatial-x'));
    let initY = parseFloat(localStorage.getItem('stormgen-spatial-y'));
    
    // Validate that coordinates are within circle bounds and are valid numbers
    const isValidPosition = (x, y) => {
        if (isNaN(x) || isNaN(y)) return false;
        const dx = x - centerX;
        const dy = y - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        return distFromCenter <= radius && x >= 15 && x <= 185 && y >= 15 && y <= 185;
    };
    
    // Use saved position if valid, otherwise use saved default
    if (!isValidPosition(initX, initY)) {
        console.warn(`Invalid spatial position loaded: (${initX}, ${initY}), using saved default: (${savedDefaultX}, ${savedDefaultY})`);
        initX = savedDefaultX;
        initY = savedDefaultY;
        // Clear bad localStorage values
        localStorage.removeItem('stormgen-spatial-x');
        localStorage.removeItem('stormgen-spatial-y');
    }
    
    console.log(`Initializing spatial audio at: (${initX}, ${initY})`);
    
    // Update SVG handle position - explicitly set both outer and inner circles
    spatialHandle.setAttribute('cx', initX);
    spatialHandle.setAttribute('cy', initY);
    spatialHandleInner.setAttribute('cx', initX);
    spatialHandleInner.setAttribute('cy', initY);
    
    // Verify the positions were actually set
    console.log(`Spatial handle set to: cx=${spatialHandle.getAttribute('cx')}, cy=${spatialHandle.getAttribute('cy')}`);
    
    // Initialize spatial audio with loaded position
    updateSpatialAudio(initX, initY);
    
    // Initialize headphone mode visual state
    if (isHeadphoneMode) {
        spatialHandle.classList.add('headphone-mode');
        spatialHandleInner.classList.add('headphone-mode');
    }
    
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
        });
    });
    
    // ===== WAVEFORM + TITLE STICKY ON SCROLL (ONLY WHEN BOTH SETTINGS & OSC OPEN) =====
    const settingsPanel = document.getElementById('settings-panel');
    const oscPanel = document.getElementById('osc-panel');
    const waveformContainer = document.getElementById('waveform-container');
    const titleRow = document.querySelector('.title-row');
    const container = document.querySelector('.container');
    
    // Force remove any sticky classes on load (clean slate)
    if (waveformContainer) waveformContainer.classList.remove('sticky-active');
    if (titleRow) titleRow.classList.remove('sticky-active');
    
    // Make waveform/title sticky only when BOTH Settings AND OSC panels are open
    const initialOffset = 80; // Need to scroll significantly to trigger sticky
    
    function handleScrollSticky() {
        if (!waveformContainer || !titleRow || !container || !settingsPanel || !oscPanel) return;
        
        const scrollTop = container.scrollTop;
        
        // Check if BOTH Settings and OSC panels are open
        const settingsOpen = settingsPanel.hasAttribute('open');
        const oscOpen = oscPanel.hasAttribute('open');
        const bothOpen = settingsOpen && oscOpen;
        
        // Only apply sticky if BOTH panels are open AND user has scrolled significantly
        const shouldBeSticky = scrollTop >= initialOffset && bothOpen;
        
        if (shouldBeSticky) {
            waveformContainer.classList.add('sticky-active');
            titleRow.classList.add('sticky-active');
            // Add padding to container to prevent content from being hidden under fixed header
            container.style.paddingTop = '100px';
        } else {
            waveformContainer.classList.remove('sticky-active');
            titleRow.classList.remove('sticky-active');
            // Remove extra padding when not sticky
            container.style.paddingTop = '20px';
        }
    }
    
    // Listen for scroll events on the container
    if (container) {
        container.addEventListener('scroll', handleScrollSticky);
    }
    
    // When either panel toggles, re-evaluate sticky state
    if (settingsPanel) {
        settingsPanel.addEventListener('toggle', () => {
            // Always re-check if sticky should be active based on current state
            handleScrollSticky();
        });
    }
    
    if (oscPanel) {
        oscPanel.addEventListener('toggle', () => {
            // Always re-check if sticky should be active based on current state
            handleScrollSticky();
        });
    }
    
    // Check on load immediately
    handleScrollSticky();
    
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
    
    // Waveform Line Opacity
    const oscOpacitySlider = document.getElementById('oscOpacity');
    const oscOpacityLabel = document.getElementById('oscOpacityLabel');
    if (oscOpacitySlider) {
        // Load saved waveform visibility
        const savedWaveformOpacity = localStorage.getItem('stormgen-waveform-opacity');
        if (savedWaveformOpacity) {
            oscOpacitySlider.value = savedWaveformOpacity;
        }
        
        oscOpacitySlider.addEventListener('input', () => {
            const value = parseFloat(oscOpacitySlider.value);
            oscSettings.lineOpacity = value;
            oscOpacityLabel.textContent = Math.round(value * 100) + '%';
            // Save waveform visibility
            localStorage.setItem('stormgen-waveform-opacity', value);
        });
        
        // Initialize visual state on load
        const waveformOpacityValue = parseFloat(oscOpacitySlider.value);
        oscSettings.lineOpacity = waveformOpacityValue;
        oscOpacityLabel.textContent = Math.round(waveformOpacityValue * 100) + '%';
    }
    
    // Title Visibility
    const oscTitleOpacitySlider = document.getElementById('oscTitleOpacity');
    const oscTitleOpacityLabel = document.getElementById('oscTitleOpacityLabel');
    if (oscTitleOpacitySlider) {
        // Load saved title visibility
        const savedTitleOpacity = localStorage.getItem('stormgen-title-opacity');
        if (savedTitleOpacity) {
            oscTitleOpacitySlider.value = savedTitleOpacity;
        }
        
        oscTitleOpacitySlider.addEventListener('input', () => {
            const value = parseFloat(oscTitleOpacitySlider.value);
            const titleText = document.querySelector('.title-row h1');
            const weatherIcon = document.querySelector('.weather-icon');
            if (titleText) {
                titleText.style.opacity = value;
            }
            if (weatherIcon) {
                weatherIcon.style.opacity = value;
            }
            oscTitleOpacityLabel.textContent = Math.round(value * 100) + '%';
            // Save title visibility
            localStorage.setItem('stormgen-title-opacity', value);
        });
        
        // Initialize visibility on load
        const titleText = document.querySelector('.title-row h1');
        const weatherIcon = document.querySelector('.weather-icon');
        const titleOpacityValue = parseFloat(oscTitleOpacitySlider.value);
        if (titleText) {
            titleText.style.opacity = titleOpacityValue;
        }
        if (weatherIcon) {
            weatherIcon.style.opacity = titleOpacityValue;
        }
        oscTitleOpacityLabel.textContent = Math.round(titleOpacityValue * 100) + '%';
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
    
    // Lightning Effect Mode selector
    const oscLightningMode = document.getElementById('oscLightningMode');
    if (oscLightningMode) {
        oscLightningMode.addEventListener('change', () => {
            // Value is stored and used in showLightningIcon function
            // No need to store in oscSettings as it's a visual effect
        });
    }
    
    // Trigger all input events to update audio nodes and labels with current values
    rainVolumeSlider.dispatchEvent(new Event('input'));
    thunderVolumeSlider.dispatchEvent(new Event('input'));
    lowpassFilterSlider.dispatchEvent(new Event('input'));
    musicVolumeSlider.dispatchEvent(new Event('input'));
    musicRoomSizeSlider.dispatchEvent(new Event('input'));
    rainReverbSlider.dispatchEvent(new Event('input'));
    thunderReverbSlider.dispatchEvent(new Event('input'));
    
    // Initialize all slider fills
    initializeAllSliderFills();
});

// Function to sync waveform color with CSS theme color
function syncWaveformColorWithTheme() {
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-accent').trim();
    if (secondaryColor) {
        oscSettings.color = secondaryColor;
        // Update color picker if it exists
        const oscColorPicker = document.getElementById('oscColor');
        if (oscColorPicker) {
            oscColorPicker.value = secondaryColor;
        }
    }
}

// Function to convert hex color to RGB values
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Function to update theme color throughout the app
function updateThemeColor(color) {
    const rgb = hexToRgb(color);
    if (!rgb) return;
    
    // Update CSS variables
    document.documentElement.style.setProperty('--theme-color', color);
    document.documentElement.style.setProperty('--theme-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    
    // Save to localStorage
    localStorage.setItem('stormgen-theme-color', color);
    localStorage.setItem('stormgen-theme-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
}

// Function to update secondary accent color
function updateSecondaryColor(color) {
    const rgb = hexToRgb(color);
    if (!rgb) return;
    
    // Update CSS variables
    document.documentElement.style.setProperty('--secondary-accent', color);
    document.documentElement.style.setProperty('--secondary-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    
    // Save to localStorage
    localStorage.setItem('stormgen-secondary-color', color);
    localStorage.setItem('stormgen-secondary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    
    // Update waveform color (waveform now uses secondary color)
    syncWaveformColorWithTheme();
}

// Function to update glow intensity
function updateGlowIntensity(intensity) {
    // Update CSS variable
    document.documentElement.style.setProperty('--glow-intensity', intensity);
    
    // Save to localStorage
    localStorage.setItem('stormgen-glow-intensity', intensity);
}

// Initialize theme color pickers
window.addEventListener('DOMContentLoaded', () => {
    const themeColorPicker = document.getElementById('theme-color-picker');
    const secondaryColorPicker = document.getElementById('secondary-color-picker');
    const glowIntensitySlider = document.getElementById('glow-intensity');
    
    // Load saved theme colors and set picker values
    const savedColor = localStorage.getItem('stormgen-theme-color');
    const savedColorRgb = localStorage.getItem('stormgen-theme-color-rgb');
    const savedSecondary = localStorage.getItem('stormgen-secondary-color');
    const savedSecondaryRgb = localStorage.getItem('stormgen-secondary-color-rgb');
    const savedGlowIntensity = localStorage.getItem('stormgen-glow-intensity');
    
    if (savedColor && savedColorRgb) {
        document.documentElement.style.setProperty('--theme-color', savedColor);
        document.documentElement.style.setProperty('--theme-color-rgb', savedColorRgb);
        if (themeColorPicker) {
            themeColorPicker.value = savedColor;
        }
    } else if (themeColorPicker) {
        // Set default value if no saved color
        themeColorPicker.value = '#00ff41';
    }
    
    if (savedSecondary && savedSecondaryRgb) {
        document.documentElement.style.setProperty('--secondary-accent', savedSecondary);
        document.documentElement.style.setProperty('--secondary-accent-rgb', savedSecondaryRgb);
        if (secondaryColorPicker) {
            secondaryColorPicker.value = savedSecondary;
        }
    } else if (secondaryColorPicker) {
        // Set default value if no saved color
        secondaryColorPicker.value = '#88ff66';
    }
    
    // Load saved glow intensity
    if (savedGlowIntensity) {
        document.documentElement.style.setProperty('--glow-intensity', savedGlowIntensity);
        if (glowIntensitySlider) {
            glowIntensitySlider.value = savedGlowIntensity;
        }
    }
    
    // Live update as user changes colors
    if (themeColorPicker) {
        themeColorPicker.addEventListener('input', (e) => {
            updateThemeColor(e.target.value);
        });
    }
    
    if (secondaryColorPicker) {
        secondaryColorPicker.addEventListener('input', (e) => {
            updateSecondaryColor(e.target.value);
        });
    }
    
    // Live update as user changes glow intensity
    if (glowIntensitySlider) {
        glowIntensitySlider.addEventListener('input', (e) => {
            updateGlowIntensity(e.target.value);
        });
    }
    
    // Scanline effect toggle
    const scanlineToggle = document.getElementById('scanline-toggle');
    const savedScanline = localStorage.getItem('stormgen-scanline-enabled');
    
    // Load saved scanline preference (default is enabled)
    if (savedScanline === 'false') {
        document.body.classList.add('no-scanline');
        if (scanlineToggle) {
            scanlineToggle.checked = false;
        }
    }
    
    // Toggle scanline effect
    if (scanlineToggle) {
        scanlineToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.remove('no-scanline');
                localStorage.setItem('stormgen-scanline-enabled', 'true');
            } else {
                document.body.classList.add('no-scanline');
                localStorage.setItem('stormgen-scanline-enabled', 'false');
            }
        });
    }
});

// Call on page load to ensure waveform matches theme
window.addEventListener('load', () => {
    syncWaveformColorWithTheme();
});

// ==================== WAVEFORM VISUALIZER ====================
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

// Oscilloscope settings (defaults)
let oscSettings = {
    mode: 'waveform', // 'waveform', 'bars', 'circular', 'radial', 'polygon'
    lineWidth: 2,
    glowIntensity: 10,
    amplification: 1,
    smoothing: 0.8,
    fftSize: 2048,
    color: getComputedStyle(document.documentElement).getPropertyValue('--secondary-accent').trim(),
    bgColor: 'transparent',
    fadeTrail: 0,
    mirror: false,
    fill: false,
    dots: false,
    containerOpacity: 0.08,
    lineOpacity: 0.5
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
        // Higher slider value = stronger trail (slower fade)
        const trailStrength = Math.min(Math.max(oscSettings.fadeTrail, 0), 1);
        const fadeAlpha = 1 - trailStrength * 0.95; // 0.05..1 range
        const bgColor = oscSettings.bgColor === 'transparent' ? { r: 0, g: 0, b: 0 } : hexToRgb(oscSettings.bgColor);
        canvasCtx.fillStyle = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${fadeAlpha})`;
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Use transparent or solid background
        if (oscSettings.bgColor === 'transparent') {
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            const bgColor = hexToRgb(oscSettings.bgColor);
            canvasCtx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    // Draw based on selected mode
    if (oscSettings.mode === 'waveform') {
        drawWaveformMode();
    } else if (oscSettings.mode === 'bars') {
        drawBarsMode();
    } else if (oscSettings.mode === 'circular') {
        drawCircularMode();
    } else if (oscSettings.mode === 'radial') {
        drawRadialMode();
    } else if (oscSettings.mode === 'polygon') {
        drawPolygonMode();
    }
}

function drawWaveformMode() {
    const bufferLength = dataArray.length;
    const shadowAmount = oscSettings.fadeTrail > 0 ? 0 : oscSettings.glowIntensity;
    
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
    canvasCtx.shadowBlur = shadowAmount;
    canvasCtx.shadowColor = shadowAmount > 0 ? oscSettings.color : 'transparent';
    
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
        
        canvasCtx.strokeStyle = colorWithOpacity(baseColor, oscSettings.lineOpacity);
        canvasCtx.shadowColor = baseColor;
        
        if (oscSettings.dots) {
            // Dots mode
            canvasCtx.fillStyle = colorWithOpacity(baseColor, oscSettings.lineOpacity);
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
    const shadowAmount = oscSettings.fadeTrail > 0 ? 0 : oscSettings.glowIntensity;
    canvasCtx.shadowBlur = shadowAmount;
    canvasCtx.shadowColor = shadowAmount > 0 ? oscSettings.color : 'transparent';
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255.0) * canvas.height * oscSettings.amplification;
        const x = i * barWidth;
        const y = canvas.height / 2 - barHeight / 2;
        
        canvasCtx.fillStyle = colorWithOpacity(oscSettings.color, oscSettings.lineOpacity);
        canvasCtx.shadowColor = oscSettings.color;
        
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
    const shadowAmount = oscSettings.fadeTrail > 0 ? 0 : oscSettings.glowIntensity;
    
    canvasCtx.lineWidth = oscSettings.lineWidth;
    canvasCtx.shadowBlur = shadowAmount;
    canvasCtx.shadowColor = shadowAmount > 0 ? oscSettings.color : 'transparent';
    
    canvasCtx.beginPath();
    
    for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2;
        const amplitude = (dataArray[i] / 255.0) * oscSettings.amplification;
        const r = radius + amplitude * 100;
        
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        
        canvasCtx.strokeStyle = colorWithOpacity(oscSettings.color, oscSettings.lineOpacity);
        canvasCtx.shadowColor = oscSettings.color;
        
        if (oscSettings.dots) {
            canvasCtx.fillStyle = colorWithOpacity(oscSettings.color, oscSettings.lineOpacity);
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

function drawRadialMode() {
    const bufferLength = dataArray.length;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.48;
    const step = Math.max(1, Math.floor(bufferLength / 180));
    const shadowAmount = oscSettings.fadeTrail > 0 ? 0 : oscSettings.glowIntensity;
    canvasCtx.lineWidth = Math.max(1, oscSettings.lineWidth - 0.5);
    canvasCtx.shadowBlur = shadowAmount;
    canvasCtx.strokeStyle = colorWithOpacity(oscSettings.color, oscSettings.lineOpacity);
    canvasCtx.shadowColor = shadowAmount > 0 ? oscSettings.color : 'transparent';

    for (let i = 0; i < bufferLength; i += step) {
        const amp = dataArray[i] / 255.0;
        const r0 = baseRadius;
        const r1 = baseRadius + amp * (maxRadius - baseRadius) * oscSettings.amplification;
        const angle = (i / bufferLength) * Math.PI * 2;
        const x0 = centerX + Math.cos(angle) * r0;
        const y0 = centerY + Math.sin(angle) * r0;
        const x1 = centerX + Math.cos(angle) * r1;
        const y1 = centerY + Math.sin(angle) * r1;

        canvasCtx.beginPath();
        canvasCtx.moveTo(x0, y0);
        canvasCtx.lineTo(x1, y1);
        canvasCtx.stroke();
    }

    // Optional inner ring for cohesion
    canvasCtx.beginPath();
    canvasCtx.lineWidth = 1;
    canvasCtx.shadowBlur = 0;
    canvasCtx.strokeStyle = colorWithOpacity(oscSettings.color, 0.4);
    canvasCtx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    canvasCtx.stroke();
}

function drawPolygonMode() {
    const bufferLength = dataArray.length;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.12;
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.45;
    const points = [];
    const shadowAmount = oscSettings.fadeTrail > 0 ? 0 : oscSettings.glowIntensity;

    for (let i = 0; i < bufferLength; i++) {
        const amp = dataArray[i] / 255.0;
        const radius = baseRadius + Math.pow(amp, 1.3) * (maxRadius - baseRadius) * oscSettings.amplification;
        const angle = (i / bufferLength) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        points.push({ x, y });
    }

    canvasCtx.lineWidth = oscSettings.lineWidth;
    canvasCtx.shadowBlur = shadowAmount;
    canvasCtx.strokeStyle = colorWithOpacity(oscSettings.color, oscSettings.lineOpacity);
    canvasCtx.shadowColor = shadowAmount > 0 ? oscSettings.color : 'transparent';

    canvasCtx.beginPath();
    points.forEach((p, idx) => {
        if (idx === 0) {
            canvasCtx.moveTo(p.x, p.y);
        } else {
            canvasCtx.lineTo(p.x, p.y);
        }
    });
    canvasCtx.closePath();
    canvasCtx.stroke();

    if (oscSettings.fill) {
        const color = hexToRgb(oscSettings.color);
        canvasCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.18)`;
        canvasCtx.fill();
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

// Convert color to rgba with opacity
function colorWithOpacity(color, opacity) {
    if (color.startsWith('hsl')) {
        // For HSL colors, replace the closing parenthesis with alpha
        return color.replace(')', `, ${opacity})`).replace('hsl', 'hsla');
    } else {
        // For hex colors, convert to rgba
        const rgb = hexToRgb(color);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    }
}

// Start the visualizer
drawWaveform();


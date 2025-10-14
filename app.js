// ==================== AUDIO SETUP ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
rainGainNode.connect(rainEQNode).connect(lowpassFilterNode).connect(audioCtx.destination);
thunderGainNode.connect(lowpassFilterNode).connect(audioCtx.destination);
birdsGainNode.connect(lowpassFilterNode).connect(audioCtx.destination);

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

// Note: Music does NOT auto-play. User must click "Play" button.
// This respects browser autoplay policies and gives users full control.

    // ===== PRESET BUTTONS =====
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
    
    // ===== PANEL STATE PERSISTENCE =====
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
    
    // Resume AudioContext if needed
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (presetName === 'indoorcozy') {
        // Indoor Cozy: Max rain, heavy filtering, tiny room with reverb, music auto-plays
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 0.5;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        musicVolumeSlider.value = 40;
        musicLowpassSlider.value = 22050; // Max - no filtering on music
        musicRoomSizeSlider.value = 0.05; // Very small room
        musicReverbSlider.value = 0.60; // Higher reverb mix
        
        // Start music if not already playing
        if (!defaultMusicAudio || defaultMusicAudio.paused) {
            playDefaultMusic();
        }
        
    } else if (presetName === 'indoor') {
        // Indoor: Same as Indoor Cozy but NO auto-play music
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 0.5;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        musicVolumeSlider.value = 40;
        musicLowpassSlider.value = 22050; // Max - no filtering on music
        musicRoomSizeSlider.value = 0.05; // Very small room
        musicReverbSlider.value = 0.60; // Higher reverb mix
        
        // Do NOT auto-play music for Indoor preset
        
    } else if (presetName === 'outdoor') {
        // Outdoor: Light rain, open sound, no reverb, no auto-play music
        rainVolumeSlider.value = 0.25; // 1/4 volume
        thunderVolumeSlider.value = 0.5; // Half way
        lowpassFilterSlider.value = 22050; // Max - no filtering
        musicVolumeSlider.value = 50; // Half volume
        musicLowpassSlider.value = 22050; // Max - no filtering
        musicRoomSizeSlider.value = 0.05; // Small room
        musicReverbSlider.value = 0; // No reverb
        
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
    
    // Start storm if not already playing
    if (!isPlaying) {
        startStorm();
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
    
    const stormIcon = document.querySelector('.storm-icon');
    if (stormIcon) {
        const strikes = 1 + Math.floor(Math.random() * 3);
        let i = 0;
        
        function flash() {
            stormIcon.classList.add('active');
            setTimeout(() => {
                stormIcon.classList.remove('active');
                i++;
                if (i < strikes) {
                    setTimeout(flash, 120 + Math.random() * 180);
                }
            }, 80 + Math.random() * 120);
        }
        flash();
    }
    
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
        musicLowpassNode.connect(musicDryGain).connect(audioCtx.destination);
        musicLowpassNode.connect(musicReverbNode).connect(musicWetGain).connect(audioCtx.destination);
        
        // Set initial volume from slider
        const musicVolumeSlider = document.getElementById('musicVolume');
        if (musicVolumeSlider) {
            defaultMusicAudio.volume = parseFloat(musicVolumeSlider.value) / 100;
        }
    }
    
    defaultMusicAudio.play().catch(err => {
        console.error('Music playback failed:', err);
    });
}

function pauseDefaultMusic() {
    if (defaultMusicAudio) defaultMusicAudio.pause();
}

function stopDefaultMusic() {
    if (defaultMusicAudio) {
        defaultMusicAudio.pause();
        defaultMusicAudio.currentTime = 0;
    }
}

// ==================== STORM CONTROL ====================
function startStorm() {
    if (isPlaying) return;
    
    // Resume AudioContext if suspended (required by browsers)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    isPlaying = true;
    playRain();
    playBirds();
    scheduleThunder();
    
    const btn = document.getElementById('stormToggleBtn');
    btn.textContent = 'Stop Storm';
    btn.classList.remove('storm-start');
    btn.classList.add('storm-stop');
    
    showRainEmojis();
}

function stopStorm() {
    isPlaying = false;
    stopRain();
    stopBirds();
    
    if (thunderTimeout) {
        clearTimeout(thunderTimeout);
        thunderTimeout = null;
    }
    
    const btn = document.getElementById('stormToggleBtn');
    btn.textContent = 'Start Storm';
    btn.classList.remove('storm-stop');
    btn.classList.add('storm-start');
    
    hideRainEmojis();
}

function toggleStorm() {
    if (isPlaying) {
        stopStorm();
    } else {
        startStorm();
    }
}

// ==================== RAIN EMOJI ANIMATION ====================
let rainActive = false;
let rainDrops = [];
let rainAnimFrame = null;
const MAX_DROPS = 64;

function showRainEmojis() {
    if (rainActive) return;
    
    rainActive = true;
    const container = document.getElementById('rain-emoji-container');
    container.style.display = 'block';
    
    const rainVolume = parseFloat(document.getElementById('rainVolume').value);
    const dropCount = rainVolume === 0 ? 0 : Math.max(2, Math.round(rainVolume * MAX_DROPS));
    
    if (dropCount > 0) {
        createRainDrops(dropCount);
        animateRainDrops();
    }
}

function hideRainEmojis() {
    rainActive = false;
    const container = document.getElementById('rain-emoji-container');
    container.style.display = 'none';
    container.innerHTML = '';
    rainDrops = [];
    
    if (rainAnimFrame) {
        cancelAnimationFrame(rainAnimFrame);
        rainAnimFrame = null;
    }
}

function createRainDrops(targetCount) {
    const container = document.getElementById('rain-emoji-container');
    const titleRow = document.querySelector('.title-row');
    const width = titleRow.offsetWidth;
    const minSpacing = 32;
    
    const existingX = rainDrops.map(d => d._x);
    const dropsToAdd = targetCount - rainDrops.length;
    
    if (dropsToAdd <= 0) return;
    
    const spawnInterval = 4000 / dropsToAdd;
    let added = 0;
    
    function spawnDrop() {
        let x = Math.random() * (width - minSpacing);
        
        for (let i = 0; i < 10; i++) {
            if (existingX.every(ex => Math.abs(ex - x) >= minSpacing)) break;
            x = Math.random() * (width - minSpacing);
        }
        
        const drop = document.createElement('span');
        drop.className = 'rain-drop';
        drop.textContent = '💧';
        drop._x = x;
        drop._y = -60;
        drop._speed = 1.5;
        drop.style.left = x + 'px';
        drop.style.top = drop._y + 'px';
        
        container.appendChild(drop);
        rainDrops.push(drop);
        existingX.push(x);
        
        added++;
        if (added < dropsToAdd) {
            setTimeout(spawnDrop, spawnInterval);
        }
    }
    
    spawnDrop();
}

function animateRainDrops() {
    if (!rainActive) return;
    
    const titleRow = document.querySelector('.title-row');
    const height = titleRow.offsetHeight;
    const rainVolume = parseFloat(document.getElementById('rainVolume').value);
    const targetCount = rainVolume === 0 ? 0 : Math.max(2, Math.round(rainVolume * MAX_DROPS));
    
    for (let i = rainDrops.length - 1; i >= 0; i--) {
        const drop = rainDrops[i];
        drop._y += drop._speed;
        drop.style.top = drop._y + 'px';
        drop.style.opacity = Math.max(0.2, Math.min(0.9, rainVolume + 0.2));
        
        if (drop._y > height + 20) {
            drop.remove();
            rainDrops.splice(i, 1);
        }
    }
    
    if (rainDrops.length < targetCount) {
        createRainDrops(targetCount);
    }
    
    rainAnimFrame = requestAnimationFrame(animateRainDrops);
}

// ==================== DOM INITIALIZATION ====================
window.addEventListener('DOMContentLoaded', () => {
    // Pre-load audio buffers (doesn't play yet)
    loadBirds();
    loadRainBuffer();
    
    // Set up music reverb with corrected decay
    musicReverbNode.buffer = createImpulseResponse(2, 2); // Default room size 1.0 * 2 = decay 2
    musicWetGain.gain.value = 0.3;
    musicDryGain.gain.value = 0.7;
    
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
    
    // Apply Outdoor preset defaults
    rainVolumeSlider.value = 0.25;
    thunderVolumeSlider.value = 0.5;
    lowpassFilterSlider.value = 22050;
    musicVolumeSlider.value = 50;
    musicLowpassSlider.value = 22050;
    musicRoomSizeSlider.value = 0.05;
    musicReverbSlider.value = 0;
    
    // Set initial gain nodes from Outdoor preset values
    rainGainNode.gain.value = 0.25;
    thunderGainNode.gain.value = 0.5;
    lowpassFilterNode.frequency.value = 22050;
    musicLowpassNode.frequency.value = 22050;
    
    // Update room size reverb
    const roomDecay = 0.05 * 2;
    musicReverbNode.buffer = createImpulseResponse(2, roomDecay);
    
    // Update reverb mix
    musicWetGain.gain.value = 0;
    musicDryGain.gain.value = 1;
    
    // Update all labels to match Outdoor preset
    document.getElementById('lowpassLabel').textContent = '22050 Hz';
    document.getElementById('musicLowpassLabel').textContent = '22050 Hz';
    document.getElementById('musicRoomSizeLabel').textContent = '0.05';
    document.getElementById('musicReverbLabel').textContent = '0.00';
    document.getElementById('frequencyLabel').textContent = '15-60s';
    
    // ===== RAIN VOLUME =====
    
    rainVolumeSlider.addEventListener('input', () => {
        rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
        updateBirdsVolume();
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
    
    const musicPlayBtn = document.getElementById('musicPlayBtn');
    const musicPauseBtn = document.getElementById('musicPauseBtn');
    const musicStopBtn = document.getElementById('musicStopBtn');
    
    musicPlayBtn.addEventListener('click', playDefaultMusic);
    musicPauseBtn.addEventListener('click', pauseDefaultMusic);
    musicStopBtn.addEventListener('click', stopDefaultMusic);
    
    musicVolumeSlider.addEventListener('input', () => {
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
    
    const musicRoomSizeLabel = document.getElementById('musicRoomSizeLabel');
    
    musicRoomSizeSlider.addEventListener('input', () => {
        const sliderValue = parseFloat(musicRoomSizeSlider.value);
        
        // Invert the decay calculation so:
        // Low slider value (0.1) = small room = short reverb (low decay like 0.5)
        // High slider value (2.0) = large room = long reverb (high decay like 4)
        // Formula: decay = sliderValue * 2 (ranges from 0.2 to 4.0)
        const decay = sliderValue * 2;
        
        musicReverbNode.buffer = createImpulseResponse(2, decay);
        musicRoomSizeLabel.textContent = sliderValue.toFixed(2);
    });
    
    const stormIcon = document.querySelector('.storm-icon');
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

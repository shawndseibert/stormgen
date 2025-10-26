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

// Weather icon element
let weatherIcon = null;

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
    
// ==================== WEATHER ICON FUNCTIONS ====================
function updateWeatherIcon() {
    if (!weatherIcon) return;
    
    const rainVolume = parseFloat(document.getElementById('rainVolume').value);
    
    // Determine icon based on rain volume
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
        // Indoor Cozy: Max rain, heavy filtering, tiny room with reverb, music auto-plays
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        musicVolumeSlider.value = 100;
        musicLowpassSlider.value = 22050; // Max - no filtering on music
        musicRoomSizeSlider.value = 0.02; // Very small room
        musicReverbSlider.value = 0.80; // Higher reverb mix
        rainReverbSlider.value = 0.50; // Rain reverb for indoor space
        thunderReverbSlider.value = 0.30; // Thunder reverb for indoor space
        
        // Start music if not already playing
        if (!defaultMusicAudio || defaultMusicAudio.paused) {
            playDefaultMusic();
        }
        
    } else if (presetName === 'indoor') {
        // Indoor: Same as Indoor Cozy but NO auto-play music
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
        // Outdoor: Light rain, open sound, no reverb, no auto-play music
        rainVolumeSlider.value = 1; // Full volume
        thunderVolumeSlider.value = 1; // Full volume
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
    
    // Set rain volume to 40% when starting storm (shows rain cloud icon)
    const rainVolumeSlider = document.getElementById('rainVolume');
    rainVolumeSlider.value = 0.4;
    rainGainNode.gain.value = 0.4;
    updateWeatherIcon();
    updateBirdsVolume();
    
    isPlaying = true;
    playRain();
    playBirds();
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
    
    // Reset rain volume to 0 when stopping storm (shows sun icon)
    const rainVolumeSlider = document.getElementById('rainVolume');
    rainVolumeSlider.value = 0;
    rainGainNode.gain.value = 0;
    updateWeatherIcon();
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
window.addEventListener('DOMContentLoaded', () => {
    // Pre-load audio buffers (doesn't play yet)
    loadBirds();
    loadRainBuffer();
    
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

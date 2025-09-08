// Rain and thunder sound paths
const rainSoundPath = 'sounds/rain/rain-sound-188158.mp3';
const thunderSounds = [
    'sounds/thunder/clean-thunder-69077.mp3',
    'sounds/thunder/dry-thunder-364468.mp3',
    'sounds/thunder/heavy-thunder-sound-effect-no-copyright-338980.mp3',
    'sounds/thunder/loud-thunder-sound-effect-359272.mp3',
    'sounds/thunder/scary-thunder-27407.mp3',
    'sounds/thunder/thunder-124463.mp3',
    'sounds/thunder/thunder-25689.mp3',
    'sounds/thunder/thunder-307513.mp3'
];

let rainAudio = null;
let rainAudio2 = null;
let rainOverlapTimeout = null;
let thunderInterval = null;
let isPlaying = false;
let lastThunderIndex = -1;

// Web Audio API context and filter
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const lowpassFilterNode = audioCtx.createBiquadFilter();
lowpassFilterNode.type = 'lowpass';
lowpassFilterNode.frequency.value = document.getElementById('lowpassFilter').value;

// Peaking EQ for rain low-mid boost
const rainEQNode = audioCtx.createBiquadFilter();
rainEQNode.type = 'peaking';
rainEQNode.frequency.value = 900; // Center frequency for low-mid
rainEQNode.Q.value = 1.2;
rainEQNode.gain.value = 0;

let rainGainNode = audioCtx.createGain();
let thunderGainNode = audioCtx.createGain();

// Rain: gain -> EQ -> lowpass -> destination
rainGainNode.connect(rainEQNode).connect(lowpassFilterNode).connect(audioCtx.destination);
// Thunder: gain -> lowpass -> destination
thunderGainNode.connect(lowpassFilterNode);
// ...existing code...
// Ensure sliders and labels match their default values on load
window.addEventListener('DOMContentLoaded', () => {
    rainVolumeSlider.value = '0.25';
    thunderVolumeSlider.value = '0.5';
    thunderMinSlider.value = '15';
    thunderMaxSlider.value = '60';
    lowpassFilterSlider.value = '22050';
    lowpassLabel.textContent = lowpassFilterSlider.value + ' Hz';
    frequencyLabel.textContent = `${thunderMinSlider.value}-${thunderMaxSlider.value}s`;
    // Set gain/filter nodes to match
    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
    thunderGainNode.gain.value = parseFloat(thunderVolumeSlider.value);
    lowpassFilterNode.frequency.value = lowpassFilterSlider.value;
});

const rainVolumeSlider = document.getElementById('rainVolume');
const thunderVolumeSlider = document.getElementById('thunderVolume');
const thunderMinSlider = document.getElementById('thunderMin');
const thunderMaxSlider = document.getElementById('thunderMax');
const frequencyLabel = document.getElementById('frequencyLabel');
const lowpassFilterSlider = document.getElementById('lowpassFilter');
const lowpassLabel = document.getElementById('lowpassLabel');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');

function playRain() {
    // Stop previous rain audios and timeouts
    if (rainAudio) {
        rainAudio.pause();
        rainAudio.currentTime = 0;
        if (rainAudio._rainSource) {
            try { rainAudio._rainSource.disconnect(); } catch(e) {}
        }
    }
    if (rainAudio2) {
        rainAudio2.pause();
        rainAudio2.currentTime = 0;
        if (rainAudio2._rainSource) {
            try { rainAudio2._rainSource.disconnect(); } catch(e) {}
        }
    }
    if (rainOverlapTimeout) {
        clearTimeout(rainOverlapTimeout);
        rainOverlapTimeout = null;
    }

    rainAudio = new Audio(rainSoundPath);
    rainAudio.loop = false;
    rainAudio.volume = 1;
    const rainSource = audioCtx.createMediaElementSource(rainAudio);
    rainSource.connect(rainGainNode);
    rainAudio._rainSource = rainSource;
    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
    rainAudio.play();

    rainAudio.addEventListener('loadedmetadata', () => {
        scheduleRainOverlap();
    });
    // If metadata already loaded
    if (rainAudio.duration && !isNaN(rainAudio.duration)) {
        scheduleRainOverlap();
    }

    rainAudio.addEventListener('ended', () => {
        // Swap and restart
        if (rainAudio2) {
            rainAudio = rainAudio2;
            rainAudio2 = null;
            scheduleRainOverlap();
        } else {
            playRain();
        }
    });

    function scheduleRainOverlap() {
        if (!rainAudio.duration || isNaN(rainAudio.duration)) return;
        // Overlap 5–10 seconds before end
        const overlap = 5 + Math.random() * 5;
        const timeToOverlap = (rainAudio.duration - overlap - rainAudio.currentTime) * 1000;
        if (timeToOverlap > 0) {
            rainOverlapTimeout = setTimeout(() => {
                playRainOverlap();
            }, timeToOverlap);
        }
    }

    function playRainOverlap() {
        rainAudio2 = new Audio(rainSoundPath);
        rainAudio2.loop = false;
        rainAudio2.volume = 1;
        const rainSource2 = audioCtx.createMediaElementSource(rainAudio2);
        rainSource2.connect(rainGainNode);
        rainAudio2._rainSource = rainSource2;
        rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
        rainAudio2.play();
        // When overlap ends, do nothing (main rain handles restart)
    }
}

function stopRain() {
    if (rainAudio) {
        rainAudio.pause();
        rainAudio.currentTime = 0;
        if (rainAudio._rainSource) {
            try { rainAudio._rainSource.disconnect(); } catch(e) {}
        }
        rainAudio = null;
    }
    if (rainAudio2) {
        rainAudio2.pause();
        rainAudio2.currentTime = 0;
        if (rainAudio2._rainSource) {
            try { rainAudio2._rainSource.disconnect(); } catch(e) {}
        }
        rainAudio2 = null;
    }
    if (rainOverlapTimeout) {
        clearTimeout(rainOverlapTimeout);
        rainOverlapTimeout = null;
    }
}

function playThunder() {
    // Pick a thunder sound, avoiding the last one
    let idx;
    do {
        idx = Math.floor(Math.random() * thunderSounds.length);
    } while (thunderSounds.length > 1 && idx === lastThunderIndex);
    lastThunderIndex = idx;
    const sound = thunderSounds[idx];
    const thunderAudio = new Audio(sound);
    thunderAudio.volume = 1; // We'll use gain node for volume
    const thunderSource = audioCtx.createMediaElementSource(thunderAudio);
    thunderSource.connect(thunderGainNode);
    thunderGainNode.gain.value = parseFloat(thunderVolumeSlider.value);
    thunderAudio.play();
}

function startStorm() {
    if (isPlaying) return;
    isPlaying = true;
    playRain();
    scheduleThunder();
    playBtn.disabled = true;
    stopBtn.disabled = false;
}

function stopStorm() {
    isPlaying = false;
    stopRain();
    clearInterval(thunderInterval);
    playBtn.disabled = false;
    stopBtn.disabled = true;
}

function scheduleThunder() {
    clearTimeout(thunderInterval);
    function thunderTimeout() {
        if (!isPlaying) return;
        let min = parseInt(thunderMinSlider.value, 10);
        let max = parseInt(thunderMaxSlider.value, 10);
        if (min > max) [min, max] = [max, min];
        const next = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
        playThunder();
        thunderInterval = setTimeout(thunderTimeout, next);
    }
    // Schedule first thunder after a random interval, not immediately
    let min = parseInt(thunderMinSlider.value, 10);
    let max = parseInt(thunderMaxSlider.value, 10);
    if (min > max) [min, max] = [max, min];
    const first = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    thunderInterval = setTimeout(thunderTimeout, first);
}

rainVolumeSlider.addEventListener('input', () => {
    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
});
lowpassFilterSlider.addEventListener('input', () => {
    lowpassLabel.textContent = lowpassFilterSlider.value + ' Hz';
    const cutoff = parseFloat(lowpassFilterSlider.value);
    lowpassFilterNode.frequency.value = cutoff;
    // As cutoff goes down, boost rain low-mid more (max +8dB at min, 0dB at max)
    const min = parseFloat(lowpassFilterSlider.min);
    const max = parseFloat(lowpassFilterSlider.max);
    const boost = 8 * (1 - (cutoff - min) / (max - min));
    rainEQNode.gain.value = boost;
});
thunderVolumeSlider.addEventListener('input', () => {
    // Thunder volume is set per thunder sound
});
thunderMinSlider.addEventListener('input', () => {
    let min = thunderMinSlider.value;
    let max = thunderMaxSlider.value;
    if (parseInt(min) > parseInt(max)) [min, max] = [max, min];
    frequencyLabel.textContent = `${min}-${max}s`;
    if (isPlaying) scheduleThunder();
});
thunderMaxSlider.addEventListener('input', () => {
    let min = thunderMinSlider.value;
    let max = thunderMaxSlider.value;
    if (parseInt(min) > parseInt(max)) [min, max] = [max, min];
    frequencyLabel.textContent = `${min}-${max}s`;
    if (isPlaying) scheduleThunder();
});
playBtn.addEventListener('click', startStorm);
stopBtn.addEventListener('click', stopStorm);
document.getElementById('thunderBtn').addEventListener('click', () => {
    playThunder();
});
playBtn.addEventListener('click', startStorm);
stopBtn.addEventListener('click', stopStorm);

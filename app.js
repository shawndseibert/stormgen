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


window.addEventListener('DOMContentLoaded', () => {
    const rainVolumeSlider = document.getElementById('rainVolume');
    const thunderVolumeSlider = document.getElementById('thunderVolume');
    const thunderMinSlider = document.getElementById('thunderMin');
    const thunderMaxSlider = document.getElementById('thunderMax');
    const frequencyLabel = document.getElementById('frequencyLabel');
    const lowpassFilterSlider = document.getElementById('lowpassFilter');
    const lowpassLabel = document.getElementById('lowpassLabel');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');

    rainVolumeSlider.value = '0.25';
    thunderVolumeSlider.value = '0.5';
    thunderMinSlider.value = '15';
    thunderMaxSlider.value = '60';
    lowpassFilterSlider.value = '22050';
    lowpassLabel.textContent = lowpassFilterSlider.value + ' Hz';
    frequencyLabel.textContent = `${thunderMinSlider.value}-${thunderMaxSlider.value}s`;
    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
    thunderGainNode.gain.value = parseFloat(thunderVolumeSlider.value);
    lowpassFilterNode.frequency.value = lowpassFilterSlider.value;

    function playRain() {
        // Stop previous rain audios
        if (rainAudio && rainAudio.stop) {
            try { rainAudio.stop(); } catch(e) {}
        }
        if (rainAudio2 && rainAudio2.stop) {
            try { rainAudio2.stop(); } catch(e) {}
        }
        // Load and decode rain sound as AudioBuffer
        fetch(rainSoundPath)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                function scheduleRainOverlap() {
                    // Pick random overlap between 5 and 10 seconds
                    const overlap = 5 + Math.random() * 5;
                    const duration = audioBuffer.duration;
                    // Start first rain
                    rainAudio = audioCtx.createBufferSource();
                    rainAudio.buffer = audioBuffer;
                    rainAudio.loop = false;
                    rainAudio.connect(rainGainNode);
                    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
                    rainAudio.start(0);
                    // Schedule second rain to start before first ends
                    setTimeout(() => {
                        rainAudio2 = audioCtx.createBufferSource();
                        rainAudio2.buffer = audioBuffer;
                        rainAudio2.loop = false;
                        rainAudio2.connect(rainGainNode);
                        rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
                        rainAudio2.start(0);
                        // When second finishes, reschedule
                        rainAudio2.onended = scheduleRainOverlap;
                    }, (duration - overlap) * 1000);
                    // When first finishes, disconnect
                    rainAudio.onended = () => {
                        try { rainAudio.disconnect(); } catch(e) {}
                        rainAudio = null;
                    };
                }
                scheduleRainOverlap();
            })
            .catch(function(err) {
                console.error('Rain audio playback failed:', err);
                alert('Rain audio could not be played. See console for details.');
            });
    }
    function playThunder() {
        let idx;
        do {
            idx = Math.floor(Math.random() * thunderSounds.length);
        } while (thunderSounds.length > 1 && idx === lastThunderIndex);
        lastThunderIndex = idx;
        const sound = thunderSounds[idx];
        // Light up thunder button
        const thunderBtn = document.getElementById('thunderBtn');
        if (thunderBtn) {
            thunderBtn.classList.add('active');
            setTimeout(() => thunderBtn.classList.remove('active'), 700);
        }
        fetch(sound)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                const thunderSource = audioCtx.createBufferSource();
                thunderSource.buffer = audioBuffer;
                thunderSource.connect(thunderGainNode);
                thunderGainNode.gain.value = parseFloat(thunderVolumeSlider.value);
                thunderSource.start(0);
            })
            .catch(function(err) {
                console.error('Thunder audio playback failed:', err);
                alert('Thunder audio could not be played. See console for details.');
            });
    }
    function startStorm() {
        console.log('Play button clicked');
        if (isPlaying) return;
        isPlaying = true;
        playRain();
        scheduleThunder();
        playBtn.disabled = true;
        stopBtn.disabled = false;
    }
    function stopStorm() {
        console.log('Stop button clicked');
        isPlaying = false;
        stopRain();
        if (thunderInterval) {
            clearInterval(thunderInterval);
            thunderInterval = null;
        }
        playBtn.disabled = false;
        stopBtn.disabled = true;
    }

    function stopRain() {
        if (rainAudio && rainAudio.stop) {
            try { rainAudio.stop(); } catch(e) {}
            try { rainAudio.disconnect(); } catch(e) {}
            rainAudio = null;
        }
    }
    function scheduleThunder() {
        // Schedule thunder at random intervals between min and max
        if (!isPlaying) return;
        const min = parseFloat(thunderMinSlider.value);
        const max = parseFloat(thunderMaxSlider.value);
        const nextDelay = min * 1000 + Math.random() * (max - min) * 1000;
        window.thunderTimeout = setTimeout(() => {
            if (!isPlaying) return;
            playThunder();
            scheduleThunder();
        }, nextDelay);
    }

    rainVolumeSlider.addEventListener('input', () => {
        rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
    });
    lowpassFilterSlider.addEventListener('input', () => {
        lowpassLabel.textContent = lowpassFilterSlider.value + ' Hz';
        const cutoff = parseFloat(lowpassFilterSlider.value);
        lowpassFilterNode.frequency.value = cutoff;
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
        if (isPlaying) {
            if (window.thunderTimeout) clearTimeout(window.thunderTimeout);
            scheduleThunder();
        }
    });
    thunderMaxSlider.addEventListener('input', () => {
        let min = thunderMinSlider.value;
        let max = thunderMaxSlider.value;
        if (parseInt(min) > parseInt(max)) [min, max] = [max, min];
        frequencyLabel.textContent = `${min}-${max}s`;
        if (isPlaying) {
            if (window.thunderTimeout) clearTimeout(window.thunderTimeout);
            scheduleThunder();
        }
    });
    playBtn.addEventListener('click', startStorm);
    stopBtn.addEventListener('click', stopStorm);
    document.getElementById('thunderBtn').addEventListener('click', () => {
        playThunder();
    });
});




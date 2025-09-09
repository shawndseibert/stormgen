    // YouTube link input logic
    const ytLinkInput = document.getElementById('ytLinkInput');
    const ytLoadBtn = document.getElementById('ytLoadBtn');

    function extractYouTubeId(url) {
        // Handles various YouTube URL formats
        const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[1].length === 11) ? match[1] : null;
    }

    ytLoadBtn.addEventListener('click', () => {
        const url = ytLinkInput.value.trim();
        const videoId = extractYouTubeId(url);
        if (ytReady && videoId) {
            ytPlayer.loadVideoById(videoId);
            ytPlayer.playVideo(); // Auto-play after loading
            pauseDefaultMusic();
        } else {
            alert('Please enter a valid YouTube link.');
        }
    });
// --- YouTube Player Integration ---
// Local default music setup
const defaultMusicPath = 'sounds/music/SARAH VAUGHAN  1944-1946 (1997)(FULL ALBUM).mp3';
let defaultMusicAudio = null;
let isYouTubePlaying = false;

function playDefaultMusic() {
    if (!defaultMusicAudio) {
        defaultMusicAudio = new Audio(defaultMusicPath);
        defaultMusicAudio.loop = true;
    }
    defaultMusicAudio.volume = 0.5;
    defaultMusicAudio.play();
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
let ytPlayer;
let ytReady = false;
let ytInitialVolume = 50;

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('ytPlayer', {
        height: '1',
        width: '1',
        playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
        },
        events: {
            'onReady': function(event) {
                ytReady = true;
                ytPlayer.setVolume(ytInitialVolume);
                    // Play default music on load
                    playDefaultMusic();
            },
            'onStateChange': function(event) {
                const ytPlayBtn = document.getElementById('ytPlayBtn');
                // 1 = playing, 2 = paused, 0 = ended, 5 = cued
                if (ytPlayBtn) {
                    if (event.data === 1) {
                        ytPlayBtn.classList.add('music-playing');
                            isYouTubePlaying = true;
                            pauseDefaultMusic();
                    } else {
                        ytPlayBtn.classList.remove('music-playing');
                            if (isYouTubePlaying && (event.data === 2 || event.data === 0)) {
                                isYouTubePlaying = false;
                                playDefaultMusic();
                            }
                    }
                }
            }
                ,
                'onError': function(event) {
                    let msg = 'YouTube video cannot be played.';
                    if (event.data === 101 || event.data === 150) {
                        msg += ' This video is restricted from embedding.';
                    }
                    alert(msg);
                }
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    // Music controls (default MP3)
    const musicPlayBtn = document.getElementById('musicPlayBtn');
    const musicPauseBtn = document.getElementById('musicPauseBtn');
    const musicStopBtn = document.getElementById('musicStopBtn');
    const musicVolume = document.getElementById('musicVolume');

    // Set music volume slider to default value on load
    musicVolume.value = 50;
    if (defaultMusicAudio) defaultMusicAudio.volume = 0.5;

    musicPlayBtn.addEventListener('click', () => {
        playDefaultMusic();
    });

    musicPauseBtn.addEventListener('click', () => {
        pauseDefaultMusic();
    });

    musicStopBtn.addEventListener('click', () => {
        stopDefaultMusic();
    });

    musicVolume.addEventListener('input', (e) => {
        const vol = Number(e.target.value);
        if (defaultMusicAudio) defaultMusicAudio.volume = vol / 100;
    });
});
// Rain and thunder sound paths
const rainSoundPath = 'sounds/rain/rain-sound-188158.mp3';
const birdsSoundPath = 'sounds/birds/birds-19624.mp3';
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

// let rainAudio = null; // Removed duplicate declaration
let rainAudio = null;
let rainAudio2 = null;
let birdsAudio = null;
let birdsGainNode = null;
let birdsBuffer = null;
let birdsFadeInterval = null;
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

birdsGainNode = audioCtx.createGain();
birdsGainNode.gain.value = 0;

// Rain: gain -> EQ -> lowpass -> destination
rainGainNode.connect(rainEQNode).connect(lowpassFilterNode).connect(audioCtx.destination);
// Thunder: gain -> lowpass -> destination
thunderGainNode.connect(lowpassFilterNode);
// Birds: gain -> lowpass -> destination
birdsGainNode.connect(lowpassFilterNode);
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
    const birdsMuteBtn = document.getElementById('birdsMuteBtn');

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

    // Birds mute toggle logic
    let birdsMuted = false;
    let birdsPrevVolume = 0.3; // Default birds volume
    function updateBirdsMuteBtn() {
        if (birdsMuted) {
            birdsMuteBtn.textContent = 'Unmute Birds';
            birdsMuteBtn.style.background = '#c0392b'; // Red
            birdsMuteBtn.style.color = '#fff';
        } else {
            birdsMuteBtn.textContent = 'Mute Birds';
            birdsMuteBtn.style.background = '#27ae60'; // Play Storm button green
            birdsMuteBtn.style.color = '#fff';
        }
    }
    birdsMuteBtn.addEventListener('click', () => {
        if (!birdsMuted) {
            birdsPrevVolume = birdsGainNode.gain.value;
            stopBirds(); // Stop all birds audio
            birdsMuted = true;
        } else {
            birdsMuted = false;
            birdsGainNode.gain.value = birdsPrevVolume;
            playBirds(); // Resume birds audio
        }
        updateBirdsMuteBtn();
    });
    // Set initial button color
    updateBirdsMuteBtn();
    fetch(birdsSoundPath)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then(buffer => {
            birdsBuffer = buffer;
            playBirds();
        })
        .catch(function(err) {
            console.error('Birds audio playback failed:', err);
        });

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
                playBirds();
                // Turn Play Storm button green when rain starts
                const playBtn = document.getElementById('playBtn');
                if (playBtn) playBtn.classList.add('music-playing');
            })
            .catch(function(err) {
                console.error('Rain audio playback failed:', err);
                alert('Rain audio could not be played. See console for details.');
            });
    }

    function playBirds() {
    stopBirds();
    if (!birdsBuffer) return;
    birdsAudio = audioCtx.createBufferSource();
    birdsAudio.buffer = birdsBuffer;
    birdsAudio.loop = true;
    // Connect birdsAudio to birdsGainNode only
    birdsAudio.connect(birdsGainNode);
    birdsAudio.start(0);
    updateBirdsVolume();
    }

    function stopBirds() {
        if (birdsAudio && birdsAudio.stop) {
            try { birdsAudio.stop(); } catch(e) {}
            try { birdsAudio.disconnect(); } catch(e) {}
            birdsAudio = null;
        }
        if (birdsFadeInterval) {
            clearInterval(birdsFadeInterval);
            birdsFadeInterval = null;
        }
        birdsGainNode.gain.value = 0;
    }

    function updateBirdsVolume() {
        // Fade birds in/out based on rain volume
        const rainVol = parseFloat(rainVolumeSlider.value);
        let target = 0;
        if (rainVol < 0.5) {
            // Fade in as rain gets quieter
            target = 1 - (rainVol / 0.5); // 1 at 0, 0 at 0.5
        } else {
            target = 0;
        }
        // Smooth fade
        const FADE_SPEED = 0.02;
        if (birdsFadeInterval) clearInterval(birdsFadeInterval);
        birdsFadeInterval = setInterval(() => {
            let current = birdsGainNode.gain.value;
            if (Math.abs(current - target) < FADE_SPEED) {
                birdsGainNode.gain.value = target;
                clearInterval(birdsFadeInterval);
                birdsFadeInterval = null;
            } else {
                birdsGainNode.gain.value += (target - current) * FADE_SPEED;
            }
        }, 30);
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
        // Play YouTube music only if a video is loaded, otherwise play default music
        if (ytReady && ytPlayer.getVideoData && ytPlayer.getVideoData().video_id) {
            ytPlayer.playVideo();
            // Fallback: retry if not playing after 500ms
            setTimeout(() => {
                if (ytPlayer.getPlayerState && ytPlayer.getPlayerState() !== 1) {
                    ytPlayer.playVideo();
                }
            }, 500);
        } else {
            playDefaultMusic();
        }
        playBtn.disabled = true;
        stopBtn.disabled = false;
    }
    function stopStorm() {
        console.log('Stop button clicked');
        isPlaying = false;
        stopRain();
    stopBirds();
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
        if (rainAudio2 && rainAudio2.stop) {
            try { rainAudio2.stop(); } catch(e) {}
            try { rainAudio2.disconnect(); } catch(e) {}
            rainAudio2 = null;
        }
        // Remove green from Play Storm button when rain stops
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.classList.remove('music-playing');
    }
    function scheduleThunder() {
        // Schedule thunder at random intervals between min and max
        if (!isPlaying) return;
        const min = parseFloat(thunderMinSlider.value);
        const max = parseFloat(thunderMaxSlider.value);
        const nextDelay = min * 1000 + Math.random() * (max - min) * 1000;
        if (window.thunderTimeout) clearTimeout(window.thunderTimeout);
        window.thunderTimeout = setTimeout(() => {
            if (!isPlaying) return;
            playThunder();
            scheduleThunder();
        }, nextDelay);
    }

    rainVolumeSlider.addEventListener('input', () => {
    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
    updateBirdsVolume();
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
    // Add CSS for green button when music is playing
    const style = document.createElement('style');
    style.textContent = `.music-playing { background-color: #2ecc40 !important; color: #fff !important; }`;
    document.head.appendChild(style);
    stopBtn.addEventListener('click', stopStorm);
    document.getElementById('thunderBtn').addEventListener('click', () => {
        playThunder();
    });
});




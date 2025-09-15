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
// Music lowpass filter node
// Music lowpass filter node
// ...audioCtx will be defined later...

// ...existing code...

window.addEventListener('DOMContentLoaded', () => {
    const ytWarningClose = document.getElementById('ytWarningClose');
    if (ytWarningClose) {
        ytWarningClose.addEventListener('click', () => {
            ytWarning.style.display = 'none';
        });
    }
    const ytWarning = document.getElementById('ytWarning');
    // YouTube audio routing
    const ytAudio = document.getElementById('ytAudio');
    let ytAudioSource = null;

    function playYouTubeAudioStream(url) {
        // This expects a direct audio stream URL, not a YouTube page URL
        ytAudio.src = url;
        ytAudio.crossOrigin = 'anonymous';
        ytAudio.load();
        ytAudio.play();
        if (!ytAudioSource) {
            ytAudioSource = audioCtx.createMediaElementSource(ytAudio);
            ytAudioSource.connect(musicLowpassNode);
            musicLowpassNode.connect(musicDryGain).connect(audioCtx.destination);
            musicLowpassNode.connect(musicReverbNode).connect(musicWetGain).connect(audioCtx.destination);
        }
    }

    // Intercept YouTube link loading to use ytAudio
    ytLoadBtn.addEventListener('click', () => {
        const url = ytLinkInput.value.trim();
        // If the URL is a direct audio stream, use ytAudio
        if (url.match(/\.mp3$|\.m4a$|\.webm$|\.ogg$/)) {
            playYouTubeAudioStream(url);
            pauseDefaultMusic();
            ytWarning.style.display = 'none';
        } else {
            // Fallback: use iframe player (effects won't work)
            if (ytReady && extractYouTubeId(url)) {
                ytPlayer.loadVideoById(extractYouTubeId(url));
                ytPlayer.playVideo();
                pauseDefaultMusic();
                ytWarning.style.display = '';
            } else {
                ytWarning.style.display = '';
            }
        }
    });
    // Music reverb mix slider logic
    const musicReverbSlider = document.getElementById('musicReverb');
    const musicReverbLabel = document.getElementById('musicReverbLabel');
    musicReverbSlider.value = 0.3;
    musicReverbLabel.textContent = musicReverbSlider.value;
    // Music room size (decay) slider logic
    const musicRoomSizeSlider = document.getElementById('musicRoomSize');
    const musicRoomSizeLabel = document.getElementById('musicRoomSizeLabel');
    musicRoomSizeSlider.value = 1;
    musicRoomSizeLabel.textContent = parseFloat(musicRoomSizeSlider.value).toFixed(2);

    // Set initial impulse response
    function updateImpulseResponse() {
        // Invert mapping: higher slider = bigger room
        const minDecay = parseFloat(musicRoomSizeSlider.min);
        const maxDecay = parseFloat(musicRoomSizeSlider.max);
        const normalized = (parseFloat(musicRoomSizeSlider.value) - minDecay) / (maxDecay - minDecay);
        const decay = minDecay + (maxDecay - minDecay) * normalized;
        musicReverbNode.buffer = createImpulseResponse(2, decay);
        musicRoomSizeLabel.textContent = decay.toFixed(2);
    }
    updateImpulseResponse();

    // Set initial mix
    musicWetGain.gain.value = parseFloat(musicReverbSlider.value);
    musicDryGain.gain.value = 1 - parseFloat(musicReverbSlider.value);

    musicReverbSlider.addEventListener('input', () => {
        // Adjust wet/dry mix
        musicWetGain.gain.value = parseFloat(musicReverbSlider.value);
        musicDryGain.gain.value = 1 - parseFloat(musicReverbSlider.value);
        musicReverbLabel.textContent = musicReverbSlider.value;
    });
    musicRoomSizeSlider.addEventListener('input', updateImpulseResponse);
    // ...existing code...
    function playThunder() {
        let idx;
        do {
            idx = Math.floor(Math.random() * thunderSounds.length);
        } while (thunderSounds.length > 1 && idx === lastThunderIndex);
        lastThunderIndex = idx;
        const sound = thunderSounds[idx];
        // Flash storm icon with 1-3 staggered strikes
        const stormIcon = document.querySelector('.storm-icon');
        if (stormIcon) {
            const strikes = 1 + Math.floor(Math.random() * 3); // 1 to 3
            let i = 0;
            function flash() {
                stormIcon.classList.add('active');
                setTimeout(() => {
                    stormIcon.classList.remove('active');
                    i++;
                    if (i < strikes) {
                        setTimeout(flash, 120 + Math.random() * 180); // 120-300ms between flashes
                    }
                }, 80 + Math.random() * 120); // 80-200ms flash duration
            }
            flash();
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
    const musicLowpassSlider = document.getElementById('musicLowpass');
    const musicLowpassLabel = document.getElementById('musicLowpassLabel');
    musicLowpassSlider.value = 22050;
    musicLowpassLabel.textContent = musicLowpassSlider.value + ' Hz';
    musicLowpassSlider.addEventListener('input', () => {
        musicLowpassLabel.textContent = musicLowpassSlider.value + ' Hz';
        musicLowpassNode.frequency.value = parseFloat(musicLowpassSlider.value);
    });
});
const defaultMusicPath = 'sounds/music/SARAH VAUGHAN  1944-1946 (1997)(FULL ALBUM).mp3';
let defaultMusicAudio = null;
let isYouTubePlaying = false;

function playDefaultMusic() {
    // Stop YouTube audio stream if playing
    if (typeof ytAudio !== 'undefined' && ytAudio && !ytAudio.paused) {
        ytAudio.pause();
        ytAudio.currentTime = 0;
    }
    // Stop YouTube iframe player if playing
    if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.getPlayerState && ytPlayer.getPlayerState() === 1) {
        ytPlayer.pauseVideo();
    }
    if (!defaultMusicAudio) {
        defaultMusicAudio = new Audio(defaultMusicPath);
        defaultMusicAudio.loop = true;
        const musicSource = audioCtx.createMediaElementSource(defaultMusicAudio);
        // Music chain: source → lowpass → (dry & wet)
        musicSource.connect(musicLowpassNode);
        // Dry path
        musicLowpassNode.connect(musicDryGain).connect(audioCtx.destination);
        // Wet path
        musicLowpassNode.connect(musicReverbNode).connect(musicWetGain).connect(audioCtx.destination);
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
    // DOM elements for thunder controls
    const thunderMinSlider = document.getElementById('thunderMin');
    const thunderMaxSlider = document.getElementById('thunderMax');
    // ...existing code...
    // Rain emoji logic
    const rainEmojiContainer = document.getElementById('rain-emoji-container');
    const rainVolumeSlider = document.getElementById('rainVolume');
    let rainActive = false;
    let rainDrops = [];
    let rainDropAnimFrame = null;
    const MAX_DROPS = 64;

    function createRainDrops(count) {
        // Only add/remove drops as needed, keep existing drops
        const titleRow = document.querySelector('.title-row');
        const width = titleRow.offsetWidth;
        const titleRowHeight = titleRow.offsetHeight;
        const dropLifetime = 2000; // ms
        const frameRate = 1000 / 60; // ~16.67ms per frame
        const frames = dropLifetime / frameRate;
        const startY = -60;
        const endY = titleRowHeight + 20;
        const distance = endY - startY;
        const fixedSpeed = distance / frames;
        const minSpacing = 32; // Minimum pixel spacing between drops
        let existingX = rainDrops.map(d => d._x);
        let dropsToAdd = count - rainDrops.length;
        if (dropsToAdd <= 0) return;
        let added = 0;
    let spawnInterval = 4000 / Math.max(1, count - rainDrops.length); // Spread new drops over 4 seconds
        function spawnOneDrop() {
            let tries = 0;
            let x;
            let valid = false;
            while (!valid && tries < 20) {
                x = Math.random() * (width - minSpacing);
                valid = existingX.every(existing => Math.abs(existing - x) >= minSpacing);
                tries++;
            }
            if (!valid) {
                x = Math.random() * (width - minSpacing);
            }
            const drop = document.createElement('span');
            drop.className = 'rain-drop';
            drop.textContent = '💧';
            drop._x = x;
            drop._y = startY;
            drop._speed = fixedSpeed;
            drop.style.left = Math.round(drop._x) + 'px';
            drop.style.top = Math.round(drop._y) + 'px';
            rainEmojiContainer.appendChild(drop);
            rainDrops.push(drop);
            existingX.push(x);
            added++;
            if (added < dropsToAdd) {
                setTimeout(spawnOneDrop, spawnInterval);
            }
        }
        spawnOneDrop();
    // Do NOT remove drops when lowering count; let them finish falling
    }

    function animateRainDrops() {
        if (!rainActive) return;
        const titleRow = document.querySelector('.title-row');
        const height = titleRow.offsetHeight;
    const rainVol = parseFloat(rainVolumeSlider.value);
    const startY = -60;
    const endY = height + 20;
    // Use a single DOM update per frame for smoother animation
        for (let i = rainDrops.length - 1; i >= 0; i--) {
            const drop = rainDrops[i];
            drop._y += drop._speed;
        }
        // Batch update DOM after all positions are calculated
        for (let i = rainDrops.length - 1; i >= 0; i--) {
            const drop = rainDrops[i];
            drop.style.top = Math.round(drop._y) + 'px';
            drop.style.left = Math.round(drop._x) + 'px';
            drop.style.opacity = Math.max(0.2, Math.min(0.9, rainVol + 0.2));
            if (drop._y > endY) {
                // Remove drop from DOM and array
                if (drop.parentNode === rainEmojiContainer) rainEmojiContainer.removeChild(drop);
                rainDrops.splice(i, 1);
            }
        }
        // If we need more drops, add them (never reset existing drops)
        const desiredCount = rainVol === 0 ? 0 : Math.max(2, Math.round(rainVol * MAX_DROPS));
        if (rainActive && rainDrops.length < desiredCount) {
            createRainDrops(desiredCount);
        }
        rainDropAnimFrame = requestAnimationFrame(animateRainDrops);
    }

    function showRainEmojis() {
        if (rainActive) return;
        rainActive = true;
        rainEmojiContainer.style.display = 'block';
        const rainVol = parseFloat(rainVolumeSlider.value);
        const dropCount = rainVol === 0 ? 0 : Math.max(2, Math.round(rainVol * MAX_DROPS));
        if (dropCount === 0) {
            rainEmojiContainer.innerHTML = '';
            rainDrops = [];
            rainEmojiContainer.style.display = 'none';
            return;
        }
        createRainDrops(dropCount);
        animateRainDrops();
    }

    function hideRainEmojis() {
        rainActive = false;
        rainEmojiContainer.style.display = 'none';
        rainEmojiContainer.innerHTML = '';
        rainDrops = [];
        if (rainDropAnimFrame) {
            cancelAnimationFrame(rainDropAnimFrame);
            rainDropAnimFrame = null;
        }
    }

    rainVolumeSlider.addEventListener('input', () => {
        if (rainActive) {
            const rainVol = parseFloat(rainVolumeSlider.value);
            if (rainVol === 0) {
                // Don't spawn new drops, let existing drops finish
                rainEmojiContainer.style.display = rainDrops.length ? 'block' : 'none';
                // Do not add or remove drops
            } else {
                const dropCount = Math.max(2, Math.round(rainVol * MAX_DROPS));
                rainEmojiContainer.style.display = 'block';
                if (dropCount > rainDrops.length) {
                    createRainDrops(dropCount);
                }
                // Do NOT remove drops when lowering count; let them finish falling
            }
        }
    });

    // Replace Play/Stop with Toggle button
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
                // Set button to Start Storm (green)
                const stormToggleBtn = document.getElementById('stormToggleBtn');
                if (stormToggleBtn) {
                    stormToggleBtn.classList.remove('storm-stop');
                    stormToggleBtn.classList.add('storm-start');
                    stormToggleBtn.textContent = 'Start Storm';
                }
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
                // Turn Storm Toggle button red when rain starts
                const stormToggleBtn = document.getElementById('stormToggleBtn');
                if (stormToggleBtn) {
                stormToggleBtn.classList.remove('storm-start');
                stormToggleBtn.classList.add('storm-stop');
                stormToggleBtn.textContent = 'Stop Storm';
                }
            })
            .catch(function(err) {
                console.error('Rain audio playback failed:', err);
                alert('Rain audio could not be played. See console for details.');
            });
    }
    const stormToggleBtn = document.getElementById('stormToggleBtn');
    let stormActive = false;
    function startStorm() {
        console.log('Storm started');
        if (isPlaying) return;
        isPlaying = true;
        playRain();
        scheduleThunder();
        if (ytReady && ytPlayer.getVideoData && ytPlayer.getVideoData().video_id) {
            ytPlayer.playVideo();
            setTimeout(() => {
                if (ytPlayer.getPlayerState && ytPlayer.getPlayerState() !== 1) {
                    ytPlayer.playVideo();
                }
            }, 500);
        } else {
            playDefaultMusic();
        }
    }
    function stopStorm() {
        console.log('Storm stopped');
        isPlaying = false;
        stopRain();
        stopBirds();
        if (thunderInterval) {
            clearInterval(thunderInterval);
            thunderInterval = null;
        }
    }
    function updateStormToggleBtn() {
        if (stormActive) {
            stormToggleBtn.textContent = 'Stop Storm';
            stormToggleBtn.classList.remove('storm-start');
            stormToggleBtn.classList.add('storm-stop');
        } else {
            stormToggleBtn.textContent = 'Start Storm';
            stormToggleBtn.classList.remove('storm-stop');
            stormToggleBtn.classList.add('storm-start');
        }
    }
    function toggleStorm() {
        if (!stormActive) {
            stormActive = true;
            startStorm();
            showRainEmojis();
        } else {
            stormActive = false;
            stopStorm();
            hideRainEmojis();
        }
        updateStormToggleBtn();
    }
    stormToggleBtn.addEventListener('click', toggleStorm);
    updateStormToggleBtn();
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
// Music reverb node and wet/dry gain nodes
const musicReverbNode = audioCtx.createConvolver();
const musicWetGain = audioCtx.createGain();
const musicDryGain = audioCtx.createGain();

// Utility to create impulse response for reverb
function createImpulseResponse(duration, decay) {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioCtx.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
}
// Music lowpass filter node
const musicLowpassNode = audioCtx.createBiquadFilter();
musicLowpassNode.type = 'lowpass';
musicLowpassNode.frequency.value = 22050;
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
    // Removed playBtn and stopBtn, now using stormToggleBtn
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
                // Turn Storm Toggle button green when rain starts
                const stormToggleBtn = document.getElementById('stormToggleBtn');
                if (stormToggleBtn) {
                    stormToggleBtn.classList.add('music-playing');
                    stormToggleBtn.textContent = 'Stop Storm';
                }
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
        // Flash storm icon with 1-3 staggered strikes
        const stormIcon = document.querySelector('.storm-icon');
        if (stormIcon) {
            const strikes = 1 + Math.floor(Math.random() * 3); // 1 to 3
            let i = 0;
            function flash() {
                stormIcon.classList.add('active');
                setTimeout(() => {
                    stormIcon.classList.remove('active');
                    i++;
                    if (i < strikes) {
                        setTimeout(flash, 120 + Math.random() * 180); // 120-300ms between flashes
                    }
                }, 80 + Math.random() * 120); // 80-200ms flash duration
            }
            flash();
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
        console.log('Storm started');
        if (isPlaying) return;
        isPlaying = true;
        playRain();
        scheduleThunder();
        if (ytReady && ytPlayer.getVideoData && ytPlayer.getVideoData().video_id) {
            ytPlayer.playVideo();
            setTimeout(() => {
                if (ytPlayer.getPlayerState && ytPlayer.getPlayerState() !== 1) {
                    ytPlayer.playVideo();
                }
            }, 500);
        } else {
            playDefaultMusic();
        }
    }
    function stopStorm() {
        console.log('Storm stopped');
        isPlaying = false;
        stopRain();
        stopBirds();
        if (thunderInterval) {
            clearInterval(thunderInterval);
            thunderInterval = null;
        }
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
        // Remove green from Storm Toggle button when rain stops
        const stormToggleBtn = document.getElementById('stormToggleBtn');
        if (stormToggleBtn) {
            stormToggleBtn.classList.remove('music-playing');
            stormToggleBtn.textContent = 'Start Storm';
        }
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
    // Add CSS for green button when music is playing
    const style = document.createElement('style');
    style.textContent = `.music-playing { background-color: #2ecc40 !important; color: #fff !important; }`;
    document.head.appendChild(style);
    const stormIcon = document.querySelector('.storm-icon');
    if (stormIcon) {
        stormIcon.style.cursor = 'pointer';
        stormIcon.addEventListener('click', () => {
            playThunder();
            stormIcon.classList.add('active');
            setTimeout(() => stormIcon.classList.remove('active'), 700);
        });
    }
});

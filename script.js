const playlist = [
    { title: "Song 1", artist: "Artist A", src: "songs/s1.mp3" },
    { title: "Song 2", artist: "Artist B", src: "songs/s2.mp3" },
    { title: "Song 3", artist: "Artist C", src: "songs/s3.mp3" }
];

let currentTrackIndex = 0;
let audioContext, analyser, dataArray, animationId;
let source; 
let isWaveformMode = false; 

const audio = new Audio();
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const visualizer = document.getElementById('visualizer');
const ctx = visualizer.getContext('2d');
const volumeSlider = document.getElementById('volumeSlider');
const toggleVizBtn = document.getElementById('toggleViz');

const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');


const themeToggle = document.getElementById('themeToggle');


initAudioContext();
loadTrack(currentTrackIndex);


// ⌚ UTILITY: Format seconds into MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const formattedSeconds = remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds;
    return `${minutes}:${formattedSeconds}`;
}

// ⚠️ NEW: ERROR HANDLING FUNCTION
function handleAudioError(e) {
    console.error("Audio error occurred:", e.target.error.code, e.target.error.message);
    
    let errorMsg = "An unknown playback error occurred.";
    switch (e.target.error.code) {
        case 1:
            errorMsg = "Media loading aborted by user.";
            break;
        case 2:
            errorMsg = "Network error: file download failed.";
            break;
        case 3:
            errorMsg = "Decoding error: file is corrupted or unsupported.";
            break;
        case 4:
            errorMsg = "Source error: audio file not found (404). Check path: " + audio.src;
            break;
    }

    // Stop playback and update UI
    if (animationId) cancelAnimationFrame(animationId);
    audio.pause();
    playBtn.textContent = "▶️";
    
    titleEl.textContent = "Error Loading Track";
    artistEl.textContent = errorMsg;
    
    alert(`Playback Error: ${errorMsg}`);
}

// 🌐 ADD GLOBAL ERROR LISTENER
audio.addEventListener('error', handleAudioError);


playBtn.addEventListener('click', () => {
    // Resume context on first user gesture if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
            console.error("Failed to resume AudioContext:", err);
        });
    }

    if (audio.paused) {
        const playAttempt = () => {
            audio.play().then(() => {
                playBtn.textContent = "⏸️";
                animateVisualizer();
            }).catch(err => {
                // Handle the common Auto-play Restriction Error
                console.error("Playback failed (likely auto-play blocked):", err);
                // Only alert if the error is due to user interaction needed
                if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
                    alert("Playback requires a manual user click or permission.");
                } else {
                    alert("Playback failed. See console for details.");
                }
            });
        };

        if (audio.readyState >= 2) {
            playAttempt();
        } else {
            audio.addEventListener('canplay', playAttempt, { once: true });
        }
    } else {
        audio.pause();
        playBtn.textContent = "▶️";
        cancelAnimationFrame(animationId);
    }
});


prevBtn.addEventListener('click', () => {
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    loadAndPlayTrack();
});


nextBtn.addEventListener('click', () => {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    loadAndPlayTrack();
});


progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
});


// Handle progress bar and time display simultaneously
audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${percent}%`;
        
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
});


// Set total duration when metadata is loaded
audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        durationEl.textContent = formatTime(audio.duration);
    } else {
        durationEl.textContent = '0:00';
    }
});


audio.addEventListener('ended', () => {
    nextBtn.click();
});


toggleVizBtn.addEventListener('click', () => {
    isWaveformMode = !isWaveformMode;
    toggleVizBtn.textContent = isWaveformMode ? '📉 Wave → Bars' : '📈 Bars → Wave';
});


volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value;
});


themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    themeToggle.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
});


function loadAndPlayTrack() {
    loadTrack(currentTrackIndex);

    audio.addEventListener('canplay', () => {
        // Attempt to resume context before playing if necessary
        if (audioContext.state === 'suspended') {
             audioContext.resume();
        }

        audio.play().then(() => {
            playBtn.textContent = "⏸️";
            animateVisualizer();
        }).catch(err => {
            console.error("Auto-play failed during track change:", err);
            // If autoplay fails, at least update the UI to 'Play'
            playBtn.textContent = "▶️"; 
        });
    }, { once: true });
}

// 🎵 LOAD TRACK 
function loadTrack(index) {
    const track = playlist[index];
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist;

    // Reset UI
    if (animationId) cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, visualizer.width, visualizer.height);
    progress.style.width = "0%";
    
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = "0:00";
    playBtn.textContent = "▶️"; // Ensure button is reset to play state

    // JUST CHANGE SRC
    audio.src = track.src;
    audio.load();
    volumeSlider.value = audio.volume;
}

// 🎚️ INIT AUDIO CONTEXT 
function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // CREATE SOURCE NODE ONCE 
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
}

// 🎨 ANIMATE VISUALIZER 
function animateVisualizer() {
    if (audio.paused) return;

    animationId = requestAnimationFrame(animateVisualizer);

    // Note: Canvas size should ideally be set here based on clientWidth/clientHeight for optimal resolution (Next Step #3)
    ctx.clearRect(0, 0, visualizer.width, visualizer.height);

    if (isWaveformMode) {
        // 📈 WAVEFORM MODE
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2;
        // Use the primary color for waveform visualization
        ctx.strokeStyle = document.body.classList.contains('dark-theme') ? '#9b59b6' : '#007bff'; 
        ctx.beginPath();

        // Use bufferLength for waveform (analyser.fftSize)
        const sliceWidth = visualizer.width / analyser.fftSize; 
        let x = 0;

        for (let i = 0; i < analyser.fftSize; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * visualizer.height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(visualizer.width, visualizer.height / 2);
        ctx.stroke();
    } else {
        // 📊 BARS MODE (default)
        analyser.getByteFrequencyData(dataArray);

        const barWidth = visualizer.width / dataArray.length * 2;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = dataArray[i] / 255 * visualizer.height;
            ctx.fillStyle = `hsl(${i / dataArray.length * 360}, 100%, 50%)`;
            ctx.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
}
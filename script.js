const playlist = [
    { title: "Song 1", artist: "Artist A", src: "Songs/s1.mp3" },
    { title: "Song 2", artist: "Artist B", src: "Songs/s2.mp3" },
    { title: "Song 3", artist: "Artist C", src: "Songs/s3.mp3" }
];

let currentTrackIndex = 0;
let audioContext, analyser, dataArray, animationId;
let source; // Created once and reused

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

// Initialize audio context and source ONCE
initAudioContext();

// Load first track
loadTrack(currentTrackIndex);

// ▶️ Play/Pause
playBtn.addEventListener('click', () => {
    if (audio.paused) {
        const playAttempt = () => {
            audio.play().then(() => {
                playBtn.textContent = "⏸️";
                animateVisualizer();
            }).catch(err => {
                console.error("Playback failed:", err);
                alert("Click ▶️ again.");
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

// ⏮️ Previous
prevBtn.addEventListener('click', () => {
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    loadAndPlayTrack();
});

// ⏭️ Next
nextBtn.addEventListener('click', () => {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    loadAndPlayTrack();
});

// 🎚️ Seek
progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
});

// 🕐 Update progress bar
audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${percent}%`;
    }
});

// ▶️ Auto-next
audio.addEventListener('ended', () => {
    nextBtn.click();
});
volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value;
});

// 🔄 Load + Play
function loadAndPlayTrack() {
    loadTrack(currentTrackIndex);

    audio.addEventListener('canplay', () => {
        audio.play().then(() => {
            playBtn.textContent = "⏸️";
            animateVisualizer();
        }).catch(err => {
            console.error("Auto-play failed:", err);
        });
    }, { once: true });
}

// 🎵 LOAD TRACK — ✅ FIXED: Just change src, reuse existing source
function loadTrack(index) {
    const track = playlist[index];
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist;

    // Reset UI
    if (animationId) cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, visualizer.width, visualizer.height);
    progress.style.width = "0%";

    // ✅ JUST CHANGE SRC — DO NOT RECREATE SOURCE NODE
    audio.src = track.src;
    audio.load();
    volumeSlider.value = audio.volume;
}

// 🎚️ INIT AUDIO CONTEXT — ✅ RUNS ONCE, CREATES SOURCE NODE ONCE
function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // ✅ CREATE SOURCE NODE ONCE — IT WILL AUTOMATICALLY FOLLOW audio.src CHANGES
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
}

// 🎨 ANIMATE VISUALIZER
function animateVisualizer() {
    if (audio.paused) return;

    animationId = requestAnimationFrame(animateVisualizer);

    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, visualizer.width, visualizer.height);

    const barWidth = visualizer.width / dataArray.length * 2;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i] / 255 * visualizer.height;
        ctx.fillStyle = `hsl(${i / dataArray.length * 360}, 100%, 50%)`;
        ctx.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}
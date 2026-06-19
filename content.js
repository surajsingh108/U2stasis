console.log("Neuro-Cinematic Tracker active.");

const SAMPLE_INTERVAL_MS = 6000;
const FRAME_SIZE = 224;

let session = null;
let frameCaptureBlocked = false;

function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
}

function cleanTitle(rawTitle) {
    return rawTitle.replace(/\s*-\s*YouTube\s*$/, '');
}

function captureFrame(video) {
    if (frameCaptureBlocked) return null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = FRAME_SIZE;
        canvas.height = FRAME_SIZE;
        canvas.getContext('2d').drawImage(video, 0, 0, FRAME_SIZE, FRAME_SIZE);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (err) {
        console.log("Frame capture blocked (likely DRM content).", err);
        frameCaptureBlocked = true;
        return null;
    }
}

function sendToBackground(message) {
    try {
        chrome.runtime.sendMessage(message).catch(() => {});
    } catch (e) {
        clearInterval(intervalId);
    }
}

function freshSession(videoId, video) {
    return {
        videoId,
        lastProgress: 0,
        isLive: !Number.isFinite(video.duration),
        // behavioral event buffer — flushed on each telemetry tick
        events: [],
        tabHidden: document.hidden,
        lastPlaybackRate: video.playbackRate,
        pauseStart: null,
    };
}

function attachVideoListeners(video) {
    // Detach any previously attached listeners on this element
    video._nctCleanup?.();

    function onSeeked() {
        if (!session) return;
        const videoId = getVideoId();
        if (session.videoId !== videoId) return;
        const pct = (video.currentTime / video.duration) * 100;
        session.events.push({ type: 'seek', progress: pct, t: Date.now() });
    }

    function onPause() {
        if (!session) return;
        session.pauseStart = Date.now();
    }

    function onPlay() {
        if (!session || session.pauseStart === null) return;
        const duration = (Date.now() - session.pauseStart) / 1000;
        const pct = (video.currentTime / video.duration) * 100;
        session.events.push({ type: 'pause', duration_s: duration, progress: pct, t: Date.now() });
        session.pauseStart = null;
    }

    function onRateChange() {
        if (!session) return;
        const pct = (video.currentTime / video.duration) * 100;
        session.events.push({ type: 'rate', rate: video.playbackRate, progress: pct, t: Date.now() });
        session.lastPlaybackRate = video.playbackRate;
    }

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('pause', onPause);
    video.addEventListener('play', onPlay);
    video.addEventListener('ratechange', onRateChange);

    video._nctCleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('ratechange', onRateChange);
    };
}

document.addEventListener('visibilitychange', () => {
    if (!session) return;
    const hidden = document.hidden;
    session.tabHidden = hidden;
    const video = document.querySelector('video');
    const pct = video ? (video.currentTime / video.duration) * 100 : session.lastProgress;
    session.events.push({ type: hidden ? 'tab_hide' : 'tab_show', progress: pct, t: Date.now() });
});

function endSession(sessionToEnd) {
    if (!sessionToEnd || sessionToEnd.isLive) return;
    sendToBackground({ type: 'video_ended', payload: {
        video_id: sessionToEnd.videoId,
        final_progress_percent: sessionToEnd.lastProgress,
    }});
}

const intervalId = setInterval(() => {
    const video = document.querySelector('video');
    if (!video || video.paused) return;

    const videoId = getVideoId();
    if (!videoId) return;

    if (!session || session.videoId !== videoId) {
        endSession(session);
        session = freshSession(videoId, video);
        frameCaptureBlocked = false;
        attachVideoListeners(video);
    } else if (session.isLive && Number.isFinite(video.duration)) {
        session.isLive = false;
    }

    if (session.isLive) return;

    session.lastProgress = (video.currentTime / video.duration) * 100;

    // Drain the event buffer and send with this tick
    const events = session.events.splice(0);

    sendToBackground({ type: 'telemetry', payload: {
        video_id: videoId,
        title: cleanTitle(document.title),
        progress_percent: session.lastProgress,
        duration_s: video.duration,
        playback_rate: video.playbackRate,
        tab_hidden: session.tabHidden,
        frame: captureFrame(video),
        events,
    }});
}, SAMPLE_INTERVAL_MS);

window.addEventListener('beforeunload', () => {
    endSession(session);
});

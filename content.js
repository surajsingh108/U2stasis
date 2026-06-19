console.log("Neuro-Cinematic Tracker active.");

const SAMPLE_INTERVAL_MS = 6000; // CLIP inference is heavier than a brightness check, so sample less often
const FRAME_SIZE = 224;          // matches CLIP's native input size, keeps payloads small

let session = null;          // { videoId, lastProgress, isLive }
let frameCaptureBlocked = false; // flips true if a video turns out to be DRM-protected

function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
}

function cleanTitle(rawTitle) {
    // Strip the " - YouTube" suffix. A transient "YouTube" placeholder during navigation
    // is harmless -- the server keys sessions on video_id, not on this text.
    return rawTitle.replace(/\s*-\s*YouTube\s*$/, '');
}

function captureFrame(video) {
    if (frameCaptureBlocked) return null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = FRAME_SIZE;
        canvas.height = FRAME_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, FRAME_SIZE, FRAME_SIZE);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (err) {
        // Throws if the canvas got tainted (e.g. DRM-protected video). Stop trying for this page.
        console.log("Frame capture blocked (likely DRM content). Falling back to title-only tracking.", err);
        frameCaptureBlocked = true;
        return null;
    }
}

function sendToBackground(message) {
    try {
        chrome.runtime.sendMessage(message).catch(() => {});
    } catch (e) {
        // Extension context invalidated (extension was reloaded while this tab was open).
        // Clear the interval so the stale script stops firing entirely.
        clearInterval(intervalId);
    }
}

function endSession(sessionToEnd) {
    if (!sessionToEnd || sessionToEnd.isLive) return;
    sendToBackground({ type: 'video_ended', payload: {
        video_id: sessionToEnd.videoId,
        final_progress_percent: sessionToEnd.lastProgress
    }});
}

const intervalId = setInterval(() => {
    const video = document.querySelector('video');
    if (!video || video.paused) return;

    const videoId = getVideoId();
    if (!videoId) return;

    // YouTube is an SPA: navigating from one video to another does NOT fire beforeunload.
    // Detect the video-id change ourselves and explicitly close out the previous session
    // before starting a fresh one, so progress and twin-state never bleed across videos.
    if (!session || session.videoId !== videoId) {
        endSession(session);
        session = { videoId, lastProgress: 0, isLive: !Number.isFinite(video.duration) };
        frameCaptureBlocked = false;
    } else if (session.isLive && Number.isFinite(video.duration)) {
        // Premieres/streams can start with duration = Infinity and resolve to a normal,
        // finite-length video once buffering catches up -- stop treating it as live then.
        session.isLive = false;
    }

    if (session.isLive) return; // "watch past 80%" isn't meaningful for live streams

    session.lastProgress = (video.currentTime / video.duration) * 100;

    sendToBackground({ type: 'telemetry', payload: {
        video_id: videoId,
        title: cleanTitle(document.title),
        progress_percent: session.lastProgress,
        frame: captureFrame(video)
    }});
}, SAMPLE_INTERVAL_MS);

window.addEventListener('beforeunload', () => {
    endSession(session);
});

const WARMUP_WEIGHTS = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // title_signal, engagement, seek_back, tab_hidden, long_pause, bias
const STAY_THRESHOLD = 80.0;
const LR = 0.1;
const TWIN_DECAY = 0.85;
const AVG_DECAY  = 0.9;

// CLIP encoding moved to content.js (which has Web Worker support)
// This service worker now only receives embeddings

function dot(a, b)      { return a.reduce((s, v, i) => s + v * b[i], 0); }
function norm(a)        { return Math.sqrt(a.reduce((s, v) => s + v * v, 0)) + 1e-8; }
function cosineSim(a, b){ return dot(a, b) / (norm(a) * norm(b)); }
function addVec(a, b)   { return a.map((v, i) => v + b[i]); }
function scaleVec(a, s) { return a.map(v => v * s); }
function sigmoid(x)     { return 1 / (1 + Math.exp(-x)); }

async function getWeights() {
    const { lrWeights } = await chrome.storage.local.get('lrWeights');
    // Auto-correct: if weights are wrong size (e.g., old 6-param vs new 8-param), reset
    if (lrWeights && lrWeights.length !== WARMUP_WEIGHTS.length) {
        console.warn('[NCT] Weight size mismatch, resetting. Old:', lrWeights.length, 'Expected:', WARMUP_WEIGHTS.length);
        await saveWeights(WARMUP_WEIGHTS);
        return WARMUP_WEIGHTS;
    }
    return lrWeights || WARMUP_WEIGHTS;
}

async function saveWeights(w) {
    await chrome.storage.local.set({ lrWeights: w });
}

async function trainStep(features, label) {
    const w = await getWeights();
    const x = [...features, 1.0];
    const pred = sigmoid(dot(w, x));
    const err = pred - label;
    const newW = w.map((wi, i) => wi - LR * err * x[i]);
    await saveWeights(newW);
    return newW;
}

async function predict(features) {
    const w = await getWeights();
    const x = [...features, 1.0];
    return sigmoid(dot(w, x)) * 100;
}

const sessions = {};

function getSession(videoId) {
    if (!sessions[videoId]) {
        sessions[videoId] = {
            // behavioral state
            behaviorTwin: [0.5, 0.0, 0.0],  // [engagement_ema, seek_back_ema, tab_hidden_ema]
            seekBackCount: 0,
            longPauseCount: 0,
            tabHiddenTicks: 0,
            totalTicks: 0,
            // frame for deferred CLIP processing
            frame: null,
            // event timeline for the popup: [{type, progress, ...}]
            timeline: [],
            lastSeen: Date.now(),
        };
    }
    sessions[videoId].lastSeen = Date.now();
    return sessions[videoId];
}

function pruneOldSessions() {
    const cutoff = Date.now() - 3600 * 1000;
    for (const id of Object.keys(sessions))
        if (sessions[id].lastSeen < cutoff) delete sessions[id];
}

async function appendHistory(entry) {
    const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');
    sessionHistory.push(entry);
    if (sessionHistory.length > 200) sessionHistory.splice(0, sessionHistory.length - 200);
    await chrome.storage.local.set({ sessionHistory });
}

// Extract keywords from title for TF-IDF scoring
function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'you', 'your', 'this', 'that'].includes(w));
}

// Compute TF-IDF-inspired score: how similar is title to past finished vs abandoned videos
async function getTitleSignal(currentTitle) {
    const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');
    if (sessionHistory.length < 3) return 0.5;  // Not enough history yet

    const finishedTitles = sessionHistory.filter(s => s.user_stayed === 1).map(s => s.title || '');
    const abandonedTitles = sessionHistory.filter(s => s.user_stayed === 0).map(s => s.title || '');

    const currentTokens = new Set(tokenize(currentTitle));

    // Score: what % of finished titles share keywords with this one?
    let finishedScore = 0;
    for (const title of finishedTitles) {
        const titleTokens = tokenize(title);
        const overlap = titleTokens.filter(t => currentTokens.has(t)).length;
        if (overlap > 0) finishedScore += 1;
    }
    finishedScore /= Math.max(finishedTitles.length, 1);

    // What % of abandoned titles share keywords?
    let abandonedScore = 0;
    for (const title of abandonedTitles) {
        const titleTokens = tokenize(title);
        const overlap = titleTokens.filter(t => currentTokens.has(t)).length;
        if (overlap > 0) abandonedScore += 1;
    }
    abandonedScore /= Math.max(abandonedTitles.length, 1);

    // Return difference: positive if more finished videos share keywords, negative if more abandoned
    // Clamp to [0, 1]
    const signal = (finishedScore - abandonedScore) / 2 + 0.5;
    return Math.max(0, Math.min(1, signal));
}

// Derive a 0-1 engagement score from behavioral events in this tick.
// seek_back = rewinding (high interest), seek_fwd = skipping (low interest),
// long pause = disengaged, tab hidden = disengaged, rate > 1.5 = impatient but still watching.
function behaviorScore(events, tabHidden, playbackRate) {
    let score = tabHidden ? 0.2 : 0.8;

    // speed: 1x = neutral, 2x = slightly lower, 0.5x = higher interest
    score *= (playbackRate <= 1.0) ? 1.0 : (playbackRate <= 1.5) ? 0.9 : 0.75;

    for (const e of events) {
        if (e.type === 'seek') {
            // rewind = strong positive signal, skip forward = mild negative
            score = e.progress < (sessions[e.video_id]?.lastProgress ?? 50)
                ? Math.min(1, score + 0.15)
                : Math.max(0, score - 0.1);
        }
        if (e.type === 'pause' && e.duration_s > 10) score = Math.max(0, score - 0.15);
        if (e.type === 'tab_hide') score = Math.max(0, score - 0.2);
        if (e.type === 'tab_show') score = Math.min(1, score + 0.1);
    }
    return score;
}

async function handleTelemetry(payload) {
    const { video_id, title, progress_percent, duration_s, playback_rate = 1, tab_hidden = false, events = [] } = payload;
    if (!video_id) return { error: 'missing video_id' };

    pruneOldSessions();
    const sess = getSession(video_id);
    sess.totalTicks++;

    // Accumulate timeline events (cap at 200 per session to avoid unbounded growth)
    for (const e of events) {
        sess.timeline.push(e);
        if (e.type === 'seek' && e.progress < progress_percent) sess.seekBackCount++;
        if (e.type === 'pause' && e.duration_s > 10) sess.longPauseCount++;
    }
    if (sess.timeline.length > 200) sess.timeline.splice(0, sess.timeline.length - 200);
    if (tab_hidden) sess.tabHiddenTicks++;

    // Store frame for deferred CLIP processing in notebook
    if (!sess.frame && frame_embedding) {
        sess.frame = frame_embedding;  // frame_embedding is actually frame_data (base64 data URL)
        console.log('[NCT] Frame stored for offline CLIP processing');
    }

    // --- Behavioral signals ---
    const engScore = behaviorScore(events, tab_hidden, playback_rate);
    const seekBackRate = sess.totalTicks > 0 ? sess.seekBackCount / sess.totalTicks : 0;
    const tabHiddenRate = sess.totalTicks > 0 ? sess.tabHiddenTicks / sess.totalTicks : 0;
    const longPauseRate = sess.totalTicks > 0 ? sess.longPauseCount / sess.totalTicks : 0;

    sess.behaviorTwin = addVec(
        scaleVec(sess.behaviorTwin, TWIN_DECAY),
        scaleVec([engScore, seekBackRate, tabHiddenRate], 1 - TWIN_DECAY)
    );

    // --- Title-based signal ---
    const titleSignal = await getTitleSignal(title);

    // Feature vector: [title_signal, engagement, seek_back_rate, tab_hidden_rate, long_pause_rate]
    // Visual features (alignment, novelty, drift) will be added in notebook after CLIP processing
    const features = [
        titleSignal,           // title keyword similarity to finished videos
        sess.behaviorTwin[0],  // engagement EMA
        sess.behaviorTwin[1],  // seek-back rate
        sess.behaviorTwin[2],  // tab-hidden rate
        longPauseRate,
    ];

    const prediction = await predict(features);
    sess._lastFeatures = features;
    sess._lastProgress = progress_percent;
    sess._lastDuration = duration_s;

    // Checkpoint lightweight display state so the popup can show it even if the
    // service worker was killed and restarted (losing the in-memory sessions dict).
    const displayState = {
        video_id,
        title: sess.titleText || title,
        retention_prediction: prediction,
        engagement: sess.behaviorTwin[0],
        tab_hidden,
        playback_rate,
        timeline: sess.timeline,
        progress_percent,
        duration_s,
        last_seen: Date.now(),
    };
    await chrome.storage.local.set({ activeSession: displayState });

    return displayState;
}

async function handleVideoEnded(payload) {
    const { video_id, final_progress_percent, frame_data } = payload;
    if (!video_id) return;

    const sess = sessions[video_id];
    if (!sess) return;

    const features = sess._lastFeatures || [0.5, 0.5, 0.5, 0.5, 0.5];
    const preUpdatePred = await predict(features);
    const userStayed = final_progress_percent >= STAY_THRESHOLD ? 1 : 0;
    const newWeights = await trainStep(features, userStayed);

    await appendHistory({
        timestamp: new Date().toISOString(),
        video_id,
        title: sess.titleText,
        final_progress_percent,
        user_stayed: userStayed,
        title_signal: features[0],
        engagement: features[1],
        seek_back_rate: features[2],
        tab_hidden_rate: features[3],
        long_pause_rate: features[4],
        predicted_retention_before_update: preUpdatePred,
        weights_after: newWeights,
        frame: frame_data,  // Base64 data URL for deferred CLIP processing
    });

    delete sessions[video_id];
    await chrome.storage.local.remove('activeSession');
}

async function handleStatus() {
    const { sessionHistory = [], lrWeights, activeSession } = await chrome.storage.local.get(['sessionHistory', 'lrWeights', 'activeSession']);
    const w = lrWeights || WARMUP_WEIGHTS;

    let active = Object.entries(sessions).map(([id, sess]) => {
        const features = sess._lastFeatures || [0.5, 0.5, 0.5, 0.5, 0.5];
        return {
            video_id: id,
            title: sess.titleText || id,
            retention_prediction: sigmoid(dot([...features, 1.0], w)) * 100,
            engagement:   sess.behaviorTwin[0],
            tab_hidden:   (sess.tabHiddenTicks / (sess.totalTicks || 1)) > 0.3,
            playback_rate: 1,
            timeline: sess.timeline,
            progress_percent: sess._lastProgress,
            duration_s: sess._lastDuration,
            last_seen: sess.lastSeen,
        };
    });

    // If the worker was restarted and lost in-memory state, fall back to the last
    // checkpointed display snapshot — stale but better than "no active video".
    // Discard it if it's more than 30s old (video was likely paused or navigated away).
    if (active.length === 0 && activeSession && (Date.now() - activeSession.last_seen) < 30000) {
        active = [activeSession];
    }

    active.sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));
    return { active_sessions: active, total_sessions_trained: sessionHistory.length, weights: w };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handle = async () => {
        if (message.type === 'telemetry')   return await handleTelemetry(message.payload);
        if (message.type === 'video_ended') { await handleVideoEnded(message.payload); return { ok: true }; }
        if (message.type === 'status')      return await handleStatus();
        return { error: 'unknown message type' };
    };
    handle().then(r => sendResponse({ ok: true, data: r }))
            .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
});


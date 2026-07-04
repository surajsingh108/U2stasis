const monitorDiv     = document.getElementById('monitor');
const intervalSelect = document.getElementById('interval');
const runNowBtn      = document.getElementById('runNow');
const resultDiv      = document.getElementById('result');

function esc(str) {
    return String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function scoreClass(pct) {
    return pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
}

function renderTimeline(timeline, progress, duration) {
    const pct = Math.min(100, Math.max(0, progress || 0));

    // Deduplicate events that are very close together on the bar (< 1% apart)
    const placed = [];
    const dots = (timeline || []).filter(e => {
        const p = e.progress ?? 0;
        if (placed.some(pp => Math.abs(pp - p) < 1)) return false;
        placed.push(p);
        return true;
    }).map(e => {
        const left = Math.min(98, Math.max(2, e.progress ?? 0));
        return `<div class="t-event ${esc(e.type)}" style="left:${left}%" title="${esc(e.type)}"></div>`;
    }).join('');

    const currentTime = duration ? fmtTime((pct / 100) * duration) : `${pct.toFixed(0)}%`;
    const totalTime   = duration ? fmtTime(duration) : '';

    return `
    <div class="timeline-wrap">
      <div class="timeline-label"><span>${currentTime}</span><span>${totalTime}</span></div>
      <div class="timeline-track">
        <div class="timeline-progress" style="width:${pct}%"></div>
        <div class="timeline-events">${dots}</div>
      </div>
      <div class="legend">
        <span><div class="t-event seek" style="position:relative;transform:none;width:7px;height:7px"></div> rewind</span>
        <span><div class="t-event pause" style="position:relative;transform:none;width:7px;height:7px"></div> pause</span>
        <span><div class="t-event tab_hide" style="position:relative;transform:none;width:7px;height:7px"></div> tab away</span>
        <span><div class="t-event rate" style="position:relative;transform:none;width:7px;height:7px"></div> speed change</span>
      </div>
    </div>`;
}

function renderSession(s, trained, weights) {
    const pct   = Math.round(s.retention_prediction);
    const cls   = scoreClass(pct);
    const title = s.title || s.video_id;

    const tabStatus = s.tab_hidden ? '👁️ tab away' : '▶ watching';
    const rate = s.playback_rate || 1;
    const rateStr = rate === 1 ? '1×' : `${rate}×`;
    const engPct = Math.round((s.engagement ?? 0.5) * 100);

    const wLabels = weights && weights.length >= 6
        ? `align:${weights[0].toFixed(2)} eng:${weights[1].toFixed(2)} seek:${weights[2].toFixed(2)} hidden:${weights[3].toFixed(2)} pause:${weights[4].toFixed(2)} bias:${weights[5].toFixed(2)}`
        : '';

    return `
    <div class="session">
      <div class="title" title="${esc(title)}">${esc(title)}</div>
      <div class="score-row">
        <div class="score ${cls}">${pct}%</div>
        <div class="score-label">chance you finish</div>
      </div>
      <div class="stats">
        <span>${tabStatus}</span>
        <span>🧠 eng ${engPct}</span>
        <span>⏩ ${rateStr}</span>
        <span>🎯 align ${Math.round((s.alignment ?? 0.5) * 100)}</span>
      </div>
      ${renderTimeline(s.timeline, s.progress_percent ?? s.last_progress, s.duration_s)}
      <div class="trained">${trained} video${trained !== 1 ? 's' : ''} trained on so far</div>
      ${wLabels ? `<div class="weights">${esc(wLabels)}</div>` : ''}
    </div>`;
}

function renderMonitor(data) {
    if (!data?.active_sessions?.length) {
        monitorDiv.innerHTML = '<div class="offline">No active video — play a YouTube video to start monitoring.</div>';
        return;
    }
    const trained = data.total_sessions_trained || 0;
    const weights = data.weights;
    monitorDiv.innerHTML = data.active_sessions
        .map(s => renderSession(s, trained, weights))
        .join('');
}

async function pollStatus() {
    chrome.runtime.sendMessage({ type: 'status' }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
            monitorDiv.innerHTML = '<div class="offline">Loading CLIP model (first run only — please wait)...</div>';
            return;
        }
        renderMonitor(response.data);
    });
}

pollStatus();
setInterval(pollStatus, 6000);

// --- Diagnostics ---

function renderResult(stored) {
    if (!stored?.timestamp) { resultDiv.textContent = 'No diagnostics run yet.'; return; }
    const when = new Date(stored.timestamp).toLocaleString();
    if (stored.error) {
        resultDiv.innerHTML = `<div class="timestamp">${when}</div><div class="flag">${esc(stored.error)}</div>`;
        return;
    }
    const a = stored.analysis || {};
    const flags   = (a.red_flags || []).map(f => `<div class="flag">&#9888; ${esc(f)}</div>`).join('');
    const changes = (a.suggested_changes || []).map(c => `
        <div class="change">&bull; <b>${esc(c.parameter)}</b>: ${esc(c.current_value)} &rarr; ${esc(c.suggested_value)}
        <div class="rationale">${esc(c.rationale)}</div></div>`).join('');
    resultDiv.innerHTML = `
        <div class="timestamp">${when} &middot; ${stored.session_count_analyzed ?? 0} sessions analyzed</div>
        <div>${esc(a.summary || '')}</div>${flags}${changes}`;
}

async function runDiagnostics() {
    runNowBtn.disabled = true;
    runNowBtn.textContent = 'Analysing...';
    const { sessionHistory = [], lrWeights } = await chrome.storage.local.get(['sessionHistory', 'lrWeights']);
    const n = sessionHistory.length;
    const w = lrWeights || [1.0, 0.5, -0.3, -0.5, -0.2, 0.0];
    const stayed = sessionHistory.filter(s => s.user_stayed).length;
    const stored = {
        timestamp: new Date().toISOString(),
        session_count_analyzed: n,
        analysis: {
            summary: n < 5
                ? `Only ${n} video${n !== 1 ? 's' : ''} trained on so far — predictions will improve with more data.`
                : `Trained on ${n} videos (${stayed} finished, ${n - stayed} dropped). Weights: align=${w[0].toFixed(2)}, eng=${w[1].toFixed(2)}, seek=${w[2].toFixed(2)}, hidden=${w[3].toFixed(2)}, pause=${w[4].toFixed(2)}.`,
            red_flags: n < 5 ? ['Too few training examples for reliable predictions'] : [],
            suggested_changes: [],
        }
    };
    await chrome.storage.local.set({ lastDiagnostic: stored });
    renderResult(stored);
    runNowBtn.disabled = false;
    runNowBtn.textContent = 'Run diagnostics now';
}

runNowBtn.addEventListener('click', runDiagnostics);

intervalSelect.addEventListener('change', () => {
    chrome.storage.local.set({ periodicIntervalMinutes: Number(intervalSelect.value) });
});

chrome.storage.local.get(['periodicIntervalMinutes', 'lastDiagnostic'], (stored) => {
    const minutes = stored.periodicIntervalMinutes || 0;
    intervalSelect.value = String(minutes);
    if (intervalSelect.value !== String(minutes)) {
        const opt = document.createElement('option');
        opt.value = String(minutes);
        opt.textContent = `Every ${minutes} minutes (custom)`;
        intervalSelect.appendChild(opt);
        intervalSelect.value = String(minutes);
    }
    renderResult(stored.lastDiagnostic);
});

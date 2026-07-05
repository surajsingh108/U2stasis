const monitorDiv   = document.getElementById('monitor');
const exportBtn    = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');

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

// --- Export History ---
async function exportHistory() {
    if (!exportBtn) return;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');

    const json = JSON.stringify(sessionHistory, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `session_history_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);

    if (exportStatus) {
        exportStatus.textContent = `✓ Exported ${sessionHistory.length} sessions`;
        exportStatus.style.color = 'green';
        setTimeout(() => {
            exportStatus.textContent = '';
            exportBtn.disabled = false;
            exportBtn.textContent = 'Export & Save History';
        }, 3000);
    }
}

if (exportBtn) {
    exportBtn.addEventListener('click', exportHistory);
}

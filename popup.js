const monitorDiv  = document.getElementById('monitor');
const intervalSelect = document.getElementById('interval');
const runNowBtn   = document.getElementById('runNow');
const resultDiv   = document.getElementById('result');

function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- Live monitor ---

function bar(value) {
    const pct = Math.round(value * 100);
    return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>`;
}

function renderMonitor(data) {
    if (!data || !data.active_sessions || data.active_sessions.length === 0) {
        monitorDiv.innerHTML = '<div class="offline">No active video — play a YouTube video to start monitoring.</div>';
        return;
    }
    const trained = data.total_sessions_trained || 0;
    monitorDiv.innerHTML = data.active_sessions.map(s => {
        const pct = Math.round(s.retention_prediction);
        const cls = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
        const title = s.title || s.video_id;
        return `
        <div class="session">
            <div class="title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            <div class="retention ${cls}">${pct}% chance you finish</div>
            <div class="bars">
                <span class="label">Alignment</span>${bar(s.alignment)}<span class="val">${(s.alignment * 100).toFixed(0)}</span>
                <span class="label">Novelty</span>${bar(s.novelty)}<span class="val">${(s.novelty * 100).toFixed(0)}</span>
                <span class="label">Drift</span>${bar(s.drift)}<span class="val">${(s.drift * 100).toFixed(0)}</span>
            </div>
        </div>`;
    }).join('') + `<div class="trained">${trained} video${trained !== 1 ? 's' : ''} trained on so far</div>`;
}

async function pollStatus() {
    chrome.runtime.sendMessage({ type: 'status' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
            monitorDiv.innerHTML = '<div class="offline">Initialising CLIP model (first load only — please wait)...</div>';
            return;
        }
        renderMonitor(response.data);
    });
}

pollStatus();
setInterval(pollStatus, 6000);

// --- Diagnostics ---

function renderResult(stored) {
    if (!stored || !stored.timestamp) {
        resultDiv.textContent = 'No diagnostics run yet.';
        return;
    }
    const when = new Date(stored.timestamp).toLocaleString();
    if (stored.error) {
        resultDiv.innerHTML = `<div class="timestamp">${when}</div><div class="flag">${escapeHtml(stored.error)}</div>`;
        return;
    }
    const a = stored.analysis || {};
    const flags = (a.red_flags || []).map(f => `<div class="flag">&#9888; ${escapeHtml(f)}</div>`).join('');
    const changes = (a.suggested_changes || []).map(c => `
        <div class="change">
            &bull; <b>${escapeHtml(c.parameter)}</b>: ${escapeHtml(c.current_value)} &rarr; ${escapeHtml(c.suggested_value)}
            <div class="rationale">${escapeHtml(c.rationale)}</div>
        </div>
    `).join('');
    resultDiv.innerHTML = `
        <div class="timestamp">${when} &middot; ${stored.session_count_analyzed ?? 0} sessions analyzed</div>
        <div>${escapeHtml(a.summary || '')}</div>
        ${flags}${changes}
    `;
}

async function runDiagnostics() {
    runNowBtn.disabled = true;
    runNowBtn.textContent = 'Analysing...';
    const { sessionHistory = [], lrWeights } = await chrome.storage.local.get(['sessionHistory', 'lrWeights']);
    const n = sessionHistory.length;
    const w = lrWeights || [1.0, -0.5, -0.5, 0.0];
    const stayed = sessionHistory.filter(s => s.user_stayed).length;
    const stored = {
        timestamp: new Date().toISOString(),
        session_count_analyzed: n,
        analysis: {
            summary: n < 5
                ? `Only ${n} video${n !== 1 ? 's' : ''} trained on so far — predictions will improve with more data.`
                : `Trained on ${n} videos (${stayed} finished, ${n - stayed} dropped). Current weights: alignment=${w[0].toFixed(2)}, novelty=${w[1].toFixed(2)}, drift=${w[2].toFixed(2)}.`,
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

// ============================================
// TOEFL 单词记忆大师 - Application Logic
// ============================================

// ---- Global State ----
let words = [];
let currentView = "home";
let classicList = [];
let classicIdx = 0;
let favorites = [];
let difficult = [];
let learned = {};
let mastered = {};
let mistakeBook = [];
let wordNotes = {};
let reviewRecord = {};
let speechRate = 0.9;
let baseFontSize = 16;

let activeQuiz = null;
let currentQ = null;
let quizFeedback = null;
let isMarkMasterProcessing = false;
let meaningMask = false;
let transMask = false;

// ---- Storage Keys ----
const STORAGE = {
    fav: 'tf_fav',
    diff: 'tf_diff',
    learned: 'tf_learn',
    mastered: 'tf_master',
    mistakes: 'tf_mistakes',
    cidx: 'tf_cidx',
    theme: 'tf_theme',
    notes: 'tf_notes',
    review: 'tf_review',
    font: 'tf_font',
    rate: 'tf_rate'
};

// ============================================
// Utility Functions
// ============================================

function saveData() {
    try {
        localStorage.setItem(STORAGE.fav, JSON.stringify(favorites));
        localStorage.setItem(STORAGE.diff, JSON.stringify(difficult));
        localStorage.setItem(STORAGE.learned, JSON.stringify(learned));
        localStorage.setItem(STORAGE.mastered, JSON.stringify(mastered));
        localStorage.setItem(STORAGE.mistakes, JSON.stringify(mistakeBook));
        localStorage.setItem(STORAGE.cidx, classicIdx);
        localStorage.setItem(STORAGE.notes, JSON.stringify(wordNotes));
        localStorage.setItem(STORAGE.review, JSON.stringify(reviewRecord));
        localStorage.setItem(STORAGE.font, baseFontSize);
        localStorage.setItem(STORAGE.rate, speechRate);
        updateMistakeBadge();
    } catch (e) {
        console.error("Storage error:", e);
        showToast("⚠️ 存储失败，请清理缓存");
    }
}

function loadData() {
    favorites = JSON.parse(localStorage.getItem(STORAGE.fav) || '[]');
    difficult = JSON.parse(localStorage.getItem(STORAGE.diff) || '[]');
    learned = JSON.parse(localStorage.getItem(STORAGE.learned) || '{}');
    mastered = JSON.parse(localStorage.getItem(STORAGE.mastered) || '{}');
    mistakeBook = JSON.parse(localStorage.getItem(STORAGE.mistakes) || '[]');
    wordNotes = JSON.parse(localStorage.getItem(STORAGE.notes) || '{}');
    reviewRecord = JSON.parse(localStorage.getItem(STORAGE.review) || '{}');
    classicIdx = parseInt(localStorage.getItem(STORAGE.cidx) || '0');
    baseFontSize = parseInt(localStorage.getItem(STORAGE.font) || '16');
    speechRate = parseFloat(localStorage.getItem(STORAGE.rate) || '0.9');
    if (isNaN(classicIdx)) classicIdx = 0;
    setFontSize(baseFontSize, false);
    updateMistakeBadge();
}

function showToast(msg, duration = 2000) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

function closePanels() {
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
    document.getElementById('overlay').classList.remove('show');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shuffle(arr) {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function updateMistakeBadge() {
    const badge = document.getElementById('mistakeBadge');
    if (badge) {
        if (mistakeBook.length > 0) {
            badge.style.display = 'flex';
            badge.textContent = mistakeBook.length > 99 ? '99+' : mistakeBook.length;
        } else {
            badge.style.display = 'none';
        }
    }
}

// ============================================
// Audio & Speech
// ============================================

let audioCtx = null;

function playCorrectSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.2;
        osc.type = 'sine';
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
}

function playWrongSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 220;
        gain.gain.value = 0.2;
        osc.type = 'sawtooth';
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
}

function playWordAudio(word) {
    if (!word) return;
    const audio = new Audio(`https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`);
    audio.play().catch(() => {
        showToast("🔊 使用语音朗读...");
        speakText(word, 'en');
    });
}

function speakText(text, lang) {
    if (!text || typeof window.speechSynthesis === 'undefined') {
        showToast("浏览器不支持朗读");
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u4e00-\u9fff]/.test(text) ? 'zh-CN' : 'en-US';
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

function readExampleSentence(exampleText) {
    if (!exampleText) return;
    speakText(exampleText);
}

// ============================================
// Settings
// ============================================

function setFontSize(size, isShow) {
    baseFontSize = size;
    document.documentElement.style.setProperty('--font-size-base', size + 'px');
    saveData();
    if (isShow) showToast(`📝 字体已切换为 ${size === 14 ? '小' : size === 16 ? '中' : '大'}`);
}

function setSpeechRate(rate) {
    speechRate = rate;
    saveData();
    const labels = { 0.7: '慢速', 0.9: '正常', 1.1: '快速' };
    showToast(`🔊 语速已切换为 ${labels[rate] || rate}`);
}

// ============================================
// Theme System
// ============================================

function applyTheme(id) {
    const root = document.documentElement;
    root.style.setProperty('--primary', `var(--primary-${id})`);
    root.style.setProperty('--secondary', `var(--secondary-${id})`);
    root.style.setProperty('--accent', `var(--accent-${id})`);
    root.style.setProperty('--bg', `var(--bg-${id})`);
    root.style.setProperty('--card', `var(--card-${id})`);
    root.style.setProperty('--text', `var(--text-${id})`);
    root.style.setProperty('--text-muted', `var(--text-muted-${id})`);
    root.style.setProperty('--border', `var(--border-${id})`);
    root.style.setProperty('--shadow', `var(--shadow-${id})`);
    root.style.setProperty('--shadow-lg', `var(--shadow-lg-${id})`);
    root.style.setProperty('--gradient', `var(--gradient-${id})`);
    root.style.setProperty('--success', `var(--success-${id})`);
    root.style.setProperty('--danger', `var(--danger-${id})`);
    root.style.setProperty('--warning', `var(--warning-${id})`);
    document.body.setAttribute('data-theme', id);
    localStorage.setItem(STORAGE.theme, id);
    refreshParticles();
}

function setTheme(id) {
    applyTheme(id);
    const names = { 1: '深海蓝', 2: '暮光紫', 3: '森林绿', 4: '暖阳橙', 5: '暗夜黑' };
    showToast(`🎨 已切换至「${names[id]}」主题`);
    closePanels();
}

function refreshParticles() {
    const container = document.getElementById('particles');
    container.innerHTML = '';
    const colors = [
        getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    ];
    for (let i = 0; i < 18; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        const size = Math.random() * 20 + 8;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)] || '#3b82f6';
        p.style.animationDelay = Math.random() * 20 + 's';
        p.style.animationDuration = (Math.random() * 12 + 10) + 's';
        container.appendChild(p);
    }
}

// ============================================
// View Rendering
// ============================================

function renderCurrentView() {
    if (currentView === 'home') renderHome();
    else if (currentView === 'classic') renderClassic();
    else if (currentView === 'quiz') renderQuizUI();
    else if (currentView === 'wordlist') renderWordList();
    else if (currentView === 'dictation') renderDictation();
}

function goHome() {
    renderHome();
    currentView = "home";
    saveData();
}

// ---- Home View ----
function renderHome() {
    const total = words.length;
    const learnedCount = Object.keys(learned).length;
    const masteredCount = Object.keys(mastered).length;
    const favCount = favorites.length;
    const diffCount = difficult.length;
    const errCount = mistakeBook.length;
    const progress = total > 0 ? Math.round((learnedCount / total) * 100) : 0;

    const stats = `
    <div class="stats-dashboard fade-in">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${total}</div>
                <div class="stat-label">总单词</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${learnedCount}</div>
                <div class="stat-label">已学习</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${masteredCount}</div>
                <div class="stat-label">已掌握</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${favCount}</div>
                <div class="stat-label">收藏</div>
            </div>
        </div>
        <div class="progress-ring-container">
            <div class="progress-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle class="progress-ring-bg" cx="60" cy="60" r="52"/>
                    <circle class="progress-ring-fill" cx="60" cy="60" r="52"
                        stroke-dasharray="326.73"
                        stroke-dashoffset="${326.73 * (1 - progress / 100)}"/>
                </svg>
                <div class="progress-ring-text">
                    <div class="progress-ring-value">${progress}%</div>
                    <div class="progress-ring-label">学习进度</div>
                </div>
            </div>
            <div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">
                <div style="font-size:2rem; font-weight:800; color:var(--primary);">${errCount}</div>
                <div>待复习错题</div>
            </div>
        </div>
    </div>`;

    const modes = [
        { icon: "📖", title: "经典单词卡", desc: "完整学习 + 标记掌握", act: "startClassic()", badge: "" },
        { icon: "🎯", title: "单词选含义", desc: "看英文选中文释义", act: "startQuiz('word2meaning')", badge: "热门" },
        { icon: "🔤", title: "含义选单词", desc: "看中文选英文单词", act: "startQuiz('meaning2word')", badge: "" },
        { icon: "📝", title: "例句填空", desc: "根据语境选择单词", act: "startQuiz('example2word')", badge: "推荐" },
        { icon: "✍️", title: "单词默写", desc: "动手拼写巩固记忆", act: "startDictation()", badge: "" },
        { icon: "🧠", title: "智能复习", desc: "艾宾浩斯遗忘曲线", act: "startSmartReview()", badge: "AI" },
        { icon: "📘", title: "错题复习", desc: "针对性重做错题", act: "openMistakeReview()", badge: errCount > 0 ? `${errCount}道` : "" },
        { icon: "🎲", title: "随机挑战", desc: "混合题型随机出题", act: "randomChallenge()", badge: "" }
    ];

    let hall = `<div class="section-title">🚀 学习模式</div><div class="mode-hall">`;
    modes.forEach((m, i) => {
        hall += `
        <div class="mode-card slide-up" style="animation-delay:${i * 0.05}s" onclick="${m.act}">
            <div class="mode-icon">${m.icon}</div>
            <div class="mode-title">${m.title}</div>
            <div class="mode-desc">${m.desc}</div>
            ${m.badge ? `<div class="mode-badge">${m.badge}</div>` : ''}
        </div>`;
    });
    hall += `</div>`;

    document.getElementById('main').innerHTML = stats + hall;
    currentView = "home";
}

// ---- Search ----
function doSearch() {
    const key = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!key) { renderCurrentView(); return; }

    const res = words.filter(w => {
        const wd = (w['单词'] || '').toLowerCase();
        const me = (w['单词中文意思'] || '').toLowerCase();
        return wd.includes(key) || me.includes(key);
    });

    let html = `
    <div class="list-card fade-in">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:1.2rem; font-weight:700;">🔍 搜索结果</h3>
            <span style="color:var(--text-muted); font-size:0.9rem;">共 ${res.length} 个</span>
        </div>`;

    if (res.length === 0) {
        html += `
        <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">未找到匹配的单词</div>
        </div>`;
    } else {
        html += `<div>`;
        res.forEach((item, idx) => {
            const realIdx = words.indexOf(item);
            html += `
            <div class="list-item" onclick="jumpToWord(${realIdx})">
                <div class="list-item-index">${idx + 1}</div>
                <div class="list-item-content">
                    <div class="list-item-word">${escapeHtml(item['单词'])}</div>
                    <div class="list-item-phonetic">/${escapeHtml(item['读音'] || '')}/</div>
                    <div class="list-item-meaning">${escapeHtml(item['单词中文意思'])}</div>
                </div>
                <div class="list-item-tags">
                    ${learned[realIdx] ? '<span class="tag tag-success">已学</span>' : ''}
                    ${mastered[realIdx] ? '<span class="tag tag-primary">已掌握</span>' : ''}
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    html += `</div>`;
    document.getElementById('main').innerHTML = html;
}

// ---- Word List ----
function renderWordList() {
    currentView = "wordlist";
    const filterHtml = `
    <div class="filter-bar fade-in">
        <button class="filter-btn active" onclick="filterList('all', this)">📚 全部</button>
        <button class="filter-btn" onclick="filterList('fav', this)">⭐ 收藏</button>
        <button class="filter-btn" onclick="filterList('diff', this)">🤔 难词</button>
        <button class="filter-btn" onclick="filterList('unlearn', this)">📖 未学习</button>
    </div>`;

    document.getElementById('main').innerHTML = `
        <div class="home-corner" onclick="goHome()">🏠</div>
        ${filterHtml}
        <div class="list-card">
            <div id="listContent"></div>
        </div>`;
    filterList('all', null);
}

function filterList(type, btn) {
    if (btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    let list = [];
    for (let i = 0; i < words.length; i++) {
        if (type === 'all') list.push({ idx: i, word: words[i] });
        else if (type === 'fav' && favorites.includes(i)) list.push({ idx: i, word: words[i] });
        else if (type === 'diff' && difficult.includes(i)) list.push({ idx: i, word: words[i] });
        else if (type === 'unlearn' && !learned[i]) list.push({ idx: i, word: words[i] });
    }

    const cont = document.getElementById('listContent');
    if (list.length === 0) {
        cont.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-text">该分类下暂无单词</div>
        </div>`;
        return;
    }

    let html = `<div style="margin-bottom:12px; color:var(--text-muted); font-size:0.9rem;">共 ${list.length} 个单词</div>`;
    list.forEach((item, i) => {
        const w = item.word;
        html += `
        <div class="list-item" onclick="jumpToWord(${item.idx})">
            <div class="list-item-index">${i + 1}</div>
            <div class="list-item-content">
                <div class="list-item-word">${escapeHtml(w['单词'])}</div>
                <div class="list-item-phonetic">/${escapeHtml(w['读音'] || '')}/</div>
                <div class="list-item-meaning">${escapeHtml(w['单词中文意思'])}</div>
            </div>
            <div class="list-item-tags">
                ${learned[item.idx] ? '<span class="tag tag-success">已学</span>' : '<span class="tag">未学</span>'}
                ${mastered[item.idx] ? '<span class="tag tag-primary">已掌握</span>' : ''}
                ${difficult.includes(item.idx) ? '<span class="tag tag-danger">难词</span>' : ''}
            </div>
        </div>`;
    });
    cont.innerHTML = html;
}

function jumpToWord(idx) {
    classicIdx = idx;
    startClassic();
}

// ============================================
// Classic Word Card
// ============================================

let classicContainer = null;

function startClassic() {
    if (!words.length) { showToast("单词库未加载"); return; }
    classicList = [...words];
    if (classicIdx >= classicList.length) classicIdx = 0;
    if (classicIdx < 0) classicIdx = 0;
    currentView = "classic";
    const mainEl = document.getElementById('main');
    mainEl.innerHTML = `<div class="card-base fade-in" id="classicCard"></div>`;
    classicContainer = document.getElementById('classicCard');
    updateClassicContent();
}

function getRealIdx(wordObj) {
    if (!wordObj || !wordObj['单词']) return -1;
    if (classicList[classicIdx] && classicList[classicIdx]['单词'] === wordObj['单词']) return classicIdx;
    return words.findIndex(w => w['单词'] === wordObj['单词']);
}

function updateClassicContent() {
    if (!classicList.length || classicIdx < 0 || classicIdx >= classicList.length) {
        classicIdx = 0;
        if (!classicList.length) return;
    }

    const word = classicList[classicIdx];
    if (!word || !word['单词']) {
        classicList = [...words];
        classicIdx = 0;
        updateClassicContent();
        return;
    }

    const realIdx = getRealIdx(word);
    const isFav = realIdx !== -1 && favorites.includes(realIdx);
    const isDiff = realIdx !== -1 && difficult.includes(realIdx);
    const isMaster = realIdx !== -1 && mastered[realIdx];
    const note = wordNotes[realIdx] || "";

    const exampleHtml = word['例句']
        ? `<div class="example-box" data-sentence="${escapeHtml(word['例句'])}">
            <div class="example-label">📖 例句</div>
            <div>${escapeHtml(word['例句'])}</div>
            ${word['例句中文含义'] ? `<div class="example-translation" style="${transMask ? 'opacity:0;' : ''}">${escapeHtml(word['例句中文含义'])}</div>` : ''}
        </div>` : '';

    const html = `
    <div class="home-corner" onclick="goHome()">🏠</div>
    <div class="word-header">
        <div>
            <div class="word-redzone" onclick="playWordAudio('${escapeHtml(word['单词'])}')">
                <span class="word-title">${escapeHtml(word['单词'])}</span>
                <span style="font-size:1.2rem;">🔊</span>
            </div>
            <div class="word-phonetic">/${escapeHtml(word['读音'] || '未知')}/</div>
        </div>
        <div class="word-actions">
            <button class="icon-btn" onclick="toggleFavClassic(${realIdx})" title="${isFav ? '取消收藏' : '收藏'}">
                <span>${isFav ? '⭐' : '☆'}</span>
            </button>
            <button class="icon-btn" onclick="playWordAudio('${escapeHtml(word['单词'])}')" title="发音">
                <span>🔊</span>
            </button>
        </div>
    </div>

    <div class="meaning-box">
        <div class="meaning-text ${meaningMask ? 'mask-hide' : ''}">${escapeHtml(word['单词中文意思'] || '暂无释义')}</div>
        <div class="meaning-controls">
            <button class="btn btn-sm btn-secondary" onclick="toggleMeanMask()">${meaningMask ? '👁️ 显示释义' : '🙈 遮挡释义'}</button>
            <button class="btn btn-sm btn-secondary" onclick="toggleTransMask()">${transMask ? '👁️ 显示翻译' : '🙈 隐藏翻译'}</button>
        </div>
    </div>

    ${word['记忆方法'] ? `<div class="memory-card">${escapeHtml(word['记忆方法'])}</div>` : ''}
    ${word['搭配短语'] ? `<div class="tag-group"><span class="tag">🔗 ${escapeHtml(word['搭配短语'])}</span></div>` : ''}
    ${exampleHtml}

    <div class="tag-group">
        ${isDiff ? '<span class="tag tag-danger">🤔 难词</span>' : ''}
        ${isMaster ? '<span class="tag tag-success">✅ 已掌握</span>' : ''}
        ${learned[realIdx] && !isMaster ? '<span class="tag tag-primary">📖 已学习</span>' : ''}
    </div>

    <div class="note-card">
        <p>📝 个人笔记</p>
        <textarea id="noteArea" placeholder="在此记录你对这个单词的理解、联想或记忆技巧..." onblur="saveWordNote(${realIdx})">${escapeHtml(note)}</textarea>
    </div>

    <div class="action-group">
        <button class="btn btn-secondary" onclick="prevClassic()">◀ 上一个</button>
        <button class="btn btn-danger" onclick="markDiffClassic(${realIdx})">${isDiff ? '💚 取消难词' : '🤔 标记难词'}</button>
        <button class="btn btn-success" onclick="markMasterClassic(${realIdx})">✅ 标记掌握</button>
        <button class="btn btn-primary" onclick="nextClassic()">下一个 ▶</button>
    </div>
    `;

    if (classicContainer) classicContainer.innerHTML = html;
    saveData();
}

function toggleMeanMask() { meaningMask = !meaningMask; updateClassicContent(); }
function toggleTransMask() { transMask = !transMask; updateClassicContent(); }

function saveWordNote(idx) {
    const val = document.getElementById('noteArea').value;
    wordNotes[idx] = val;
    saveData();
}

window.toggleFavClassic = function(idx) {
    if (idx === -1) return;
    const p = favorites.indexOf(idx);
    p === -1 ? favorites.push(idx) : favorites.splice(p, 1);
    saveData();
    updateClassicContent();
};

window.markDiffClassic = function(idx) {
    if (idx === -1) return;
    const p = difficult.indexOf(idx);
    p === -1 ? difficult.push(idx) : difficult.splice(p, 1);
    saveData();
    updateClassicContent();
};

window.markMasterClassic = function(idx) {
    if (idx === -1 || isMarkMasterProcessing) return;
    isMarkMasterProcessing = true;
    mastered[idx] = true;
    learned[idx] = true;
    difficult = difficult.filter(i => i !== idx);
    reviewRecord[idx] = Date.now();
    saveData();
    updateClassicContent();
    showToast("🎉 已掌握！继续加油！");
    setTimeout(() => {
        nextClassic();
        isMarkMasterProcessing = false;
    }, 800);
};

window.prevClassic = function() {
    if (!classicList.length) return;
    classicIdx--;
    if (classicIdx < 0) classicIdx = classicList.length - 1;
    updateClassicContent();
};

window.nextClassic = function() {
    if (!classicList.length) return;
    classicIdx++;
    if (classicIdx >= classicList.length) classicIdx = 0;
    updateClassicContent();
    saveData();
};

// ============================================
// Dictation Mode
// ============================================

let dictationAnswer = "";

function startDictation() {
    currentView = "dictation";
    const idx = Math.floor(Math.random() * words.length);
    const w = words[idx];
    dictationAnswer = w['单词'];

    const html = `
    <div class="card-base fade-in">
        <div class="home-corner" onclick="goHome()">🏠</div>
        <div class="quiz-header">
            <div class="quiz-mode-badge">✍️ 单词默写</div>
        </div>
        <div class="dictation-hint">
            <div style="font-size:1.3rem; font-weight:700; color:var(--text); margin-bottom:8px;">${escapeHtml(w['单词中文意思'])}</div>
            <div style="font-size:0.85rem;">请根据中文释义写出对应的英文单词</div>
        </div>
        <input class="input-mo" id="dictInput" placeholder="在此输入英文单词..." onkeydown="if(event.key==='Enter')checkDictation()">
        <div class="action-group" style="justify-content:center;">
            <button class="btn btn-primary" onclick="checkDictation()">✅ 提交</button>
            <button class="btn btn-secondary" onclick="startDictation()">🔄 下一题</button>
        </div>
        <div id="dictTip" style="text-align:center; margin-top:16px; min-height:24px;"></div>
    </div>`;

    document.getElementById('main').innerHTML = html;
    setTimeout(() => document.getElementById('dictInput')?.focus(), 100);
}

function renderDictation() {}

function checkDictation() {
    const input = document.getElementById('dictInput').value.trim().toLowerCase();
    const ans = dictationAnswer.toLowerCase();
    const tip = document.getElementById('dictTip');

    if (input === ans) {
        tip.innerHTML = `<span style="color:var(--success); font-weight:700; font-size:1.1rem;">🎉 正确！太棒了！</span>`;
        playCorrectSound();
        setTimeout(() => startDictation(), 1200);
    } else {
        tip.innerHTML = `<span style="color:var(--danger); font-weight:700;">❌ 错误，正确答案是：<span style="font-size:1.2rem;">${dictationAnswer}</span></span>`;
        playWrongSound();
    }
}

// ============================================
// Smart Review
// ============================================

function startSmartReview() {
    const now = Date.now();
    const needReview = [];

    for (let i = 0; i < words.length; i++) {
        const last = reviewRecord[i] || 0;
        const diff = now - last;
        if (last && (diff > 86400000 || diff > 259200000 || diff > 604800000)) {
            needReview.push(i);
        }
    }

    if (needReview.length === 0) {
        showToast("🎊 暂无需要复习的单词，继续保持！");
        return;
    }

    classicIdx = needReview[Math.floor(Math.random() * needReview.length)];
    showToast(`📚 为你挑选了 ${needReview.length} 个待复习单词`);
    startClassic();
}

// ============================================
// Quiz System
// ============================================

function maskExample(sentence, target) {
    if (!sentence || !target) return sentence;
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTarget})`, 'gi');
    return sentence.replace(regex, '______');
}

function getBackupOptions(correct, type, count) {
    const candidates = words
        .filter(w => type === 'word' ? w['单词'] !== correct : w['单词中文意思'] !== correct)
        .map(w => type === 'word' ? w['单词'] : w['单词中文意思'])
        .filter(v => v);
    return shuffle([...candidates]).slice(0, count);
}

function generateQuestion() {
    if (!words.length) return false;

    if (activeQuiz === 'example2word') {
        const validWords = words.filter(w => w['例句'] && w['例句'].trim());
        if (validWords.length === 0) return false;

        for (let attempt = 0; attempt < 40; attempt++) {
            const idx = Math.floor(Math.random() * validWords.length);
            const w = validWords[idx];
            const correct = w['单词'];
            const masked = maskExample(w['例句'], correct);
            const questionText = `
                <div style="margin-bottom:12px; color:var(--text-muted); font-size:0.9rem;">根据语境选择正确的单词填空</div>
                <div class="clickable-sentence" data-sentence="${escapeHtml(w['例句'])}" style="display:inline-flex; align-items:center; gap:6px; margin-bottom:16px;">
                    🔊 朗读原句
                </div>
                <div style="font-style:italic; padding:16px; background:var(--bg); border-radius:var(--radius-md); margin-top:8px; line-height:1.8;">
                    "${escapeHtml(masked)}"
                </div>`;

            let candidates = getBackupOptions(correct, 'word', 3);
            let opts = [correct, ...candidates];
            while (opts.length < 4) {
                const randomWord = words[Math.floor(Math.random() * words.length)];
                if (randomWord['单词'] && !opts.includes(randomWord['单词'])) {
                    opts.push(randomWord['单词']);
                }
            }

            currentQ = {
                wordIndex: words.findIndex(wrd => wrd['单词'] === correct),
                correct: correct,
                options: shuffle(opts),
                question: questionText,
                mode: activeQuiz,
                originalExample: w['例句']
            };
            quizFeedback = null;
            return true;
        }
        return false;
    } else {
        for (let attempt = 0; attempt < 40; attempt++) {
            const idx = Math.floor(Math.random() * words.length);
            const w = words[idx];
            let correct = '', question = '', opts = [];

            if (activeQuiz === 'word2meaning') {
                correct = w['单词中文意思'];
                question = `<span class="highlight">${escapeHtml(w['单词'])}</span> 的含义是？`;
                opts = [correct, ...getBackupOptions(correct, 'meaning', 3)];
            } else if (activeQuiz === 'meaning2word') {
                correct = w['单词'];
                question = `<span class="highlight">${escapeHtml(w['单词中文意思'])}</span> 对应的英文单词是？`;
                opts = [correct, ...getBackupOptions(correct, 'word', 3)];
            } else continue;

            if (opts.length >= 2) {
                currentQ = {
                    wordIndex: idx,
                    correct,
                    options: shuffle(opts),
                    question,
                    mode: activeQuiz
                };
                quizFeedback = null;
                return true;
            }
        }
        return false;
    }
}

function checkAnswer(selectedRaw) {
    if (quizFeedback !== null) return;
    const isCorrect = (selectedRaw === currentQ.correct);

    if (isCorrect) {
        quizFeedback = { type: "feedback-correct", message: "🎉 回答正确！太棒了！" };
        playCorrectSound();
        showToast("✅ 正确 +1");
        if (currentQ.wordIndex !== undefined && currentQ.wordIndex !== -1) {
            learned[currentQ.wordIndex] = true;
            reviewRecord[currentQ.wordIndex] = Date.now();
            saveData();
        }
    } else {
        quizFeedback = {
            type: "feedback-wrong",
            message: `❌ 错误！正确答案是：<strong>${escapeHtml(currentQ.correct)}</strong>`
        };
        playWrongSound();
        showToast("❌ 错误，已加入错题本");
        mistakeBook.unshift({
            wordIndex: currentQ.wordIndex,
            mode: activeQuiz,
            wrongAnswer: selectedRaw,
            correctAnswer: currentQ.correct,
            timestamp: Date.now()
        });
        if (mistakeBook.length > 150) mistakeBook.pop();
        saveData();
    }
    renderQuizUI();
}

function renderQuizUI() {
    if (!currentQ) {
        if (!generateQuestion()) {
            document.getElementById('main').innerHTML = `
                <div class="card-base">
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <div class="empty-state-text">题目生成失败，请重试</div>
                    </div>
                </div>`;
            return;
        }
    }

    const isAnswered = (quizFeedback !== null);
    const modeLabels = {
        'word2meaning': '🎯 单词选含义',
        'meaning2word': '🔤 含义选单词',
        'example2word': '📝 例句填空'
    };

    let optsHtml = currentQ.options.map((opt, i) => {
        let extraClass = '';
        let onclickAttr = '';

        if (isAnswered) {
            extraClass = 'disabled';
            if (opt === currentQ.correct) extraClass += ' correct';
        } else {
            onclickAttr = `onclick="checkAnswer(${JSON.stringify(opt)})"`;
        }

        return `<div class="quiz-option ${extraClass}" ${onclickAttr} style="animation-delay:${i * 0.05}s">
            ${escapeHtml(opt)}
        </div>`;
    }).join('');

    const fbHtml = quizFeedback ? `<div class="quiz-feedback ${quizFeedback.type}">${quizFeedback.message}</div>` : '';
    const nextBtnHtml = isAnswered ? `<div class="next-btn-container"><button class="btn btn-primary" onclick="nextQuiz()">下一题 ▶</button></div>` : '';

    const html = `
    <div class="card-base fade-in">
        <div class="home-corner" onclick="goHome()">🏠</div>
        <div class="quiz-header">
            <div class="quiz-mode-badge">${modeLabels[activeQuiz] || '测验'}</div>
        </div>
        <div class="quiz-question">${currentQ.question}</div>
        <div class="quiz-options">${optsHtml}</div>
        ${fbHtml}
        ${nextBtnHtml}
    </div>`;

    document.getElementById('main').innerHTML = html;
}

function nextQuiz() {
    generateQuestion();
    renderQuizUI();
}

function randomChallenge() {
    const modes = ["word2meaning", "meaning2word", "example2word"];
    startQuiz(modes[Math.floor(Math.random() * modes.length)]);
}

function startQuiz(mode) {
    if (!words.length) { showToast("单词库未加载完成"); return; }
    activeQuiz = mode;
    if (!generateQuestion()) { showToast("无法生成题目，请重试"); return; }
    currentView = "quiz";
    renderQuizUI();
}

// ============================================
// Mistake Book
// ============================================

function renderMistakePanel() {
    const container = document.getElementById('mistakeListContainer');
    if (!mistakeBook.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">暂无错题，继续保持！</div>
            </div>`;
        return;
    }

    container.innerHTML = mistakeBook.slice(0, 40).map((m, i) => {
        const w = words[m.wordIndex];
        const wordTitle = w ? w['单词'] : '已删除';
        const modeLabels = {
            'word2meaning': '单词选含义',
            'meaning2word': '含义选单词',
            'example2word': '例句填空'
        };

        return `
        <div class="mistake-item">
            <div class="mistake-item-header">
                <span class="mistake-item-word">${escapeHtml(wordTitle)}</span>
                <span class="mistake-item-date">${new Date(m.timestamp).toLocaleDateString()}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">题型：${modeLabels[m.mode] || m.mode}</div>
            <div class="mistake-item-wrong">❌ 你的答案：${escapeHtml(m.wrongAnswer)}</div>
            <div class="mistake-item-correct">✅ 正确答案：${escapeHtml(m.correctAnswer)}</div>
            <div style="margin-top:10px;">
                <button class="btn btn-sm btn-secondary" onclick="retryMistake(${i})">🔄 重练此题</button>
            </div>
        </div>`;
    }).join('');
}

function clearAllMistake() {
    if (!mistakeBook.length) { showToast("错题本已经是空的"); return; }
    if (!confirm('确定要清空所有错题吗？此操作不可撤销。')) return;
    mistakeBook = [];
    saveData();
    renderMistakePanel();
    showToast("🗑️ 已清空错题本");
}

function retryMistake(idx) {
    const m = mistakeBook[idx];
    if (!m || !words[m.wordIndex]) { showToast("⚠️ 错题已失效"); return; }

    activeQuiz = m.mode;
    const w = words[m.wordIndex];
    const correct = m.correctAnswer;
    let question = '', opts = [];

    if (m.mode === 'word2meaning') {
        question = `“<span class="highlight">${escapeHtml(w['单词'])}</span>” 的含义是？`;
        opts = [correct, ...getBackupOptions(correct, 'meaning', 3)];
    } else if (m.mode === 'meaning2word') {
        question = `“<span class="highlight">${escapeHtml(w['单词中文意思'])}</span>” 对应的英文是？`;
        opts = [correct, ...getBackupOptions(correct, 'word', 3)];
    } else {
        const masked = maskExample(w['例句'], correct);
        question = `
            <div style="margin-bottom:12px; color:var(--text-muted);">根据语境填空</div>
            <div class="clickable-sentence" data-sentence="${escapeHtml(w['例句'])}" style="display:inline-flex; align-items:center; gap:6px;">🔊 朗读原句</div>
            <div style="font-style:italic; padding:16px; background:var(--bg); border-radius:var(--radius-md); margin-top:8px;">"${escapeHtml(masked)}"</div>`;
        opts = [correct, ...getBackupOptions(correct, 'word', 3)];
    }

    currentQ = {
        wordIndex: m.wordIndex,
        correct,
        options: shuffle(opts),
        question,
        mode: m.mode
    };
    quizFeedback = null;
    currentView = "quiz";
    closePanels();
    renderQuizUI();
}

function openMistakeReview() {
    if (!mistakeBook.length) { showToast("📭 暂无错题，先去学习吧！"); return; }
    retryMistake(0);
}

// ============================================
// Statistics Panel
// ============================================

function renderStatPanel() {
    const total = words.length;
    const learnCnt = Object.keys(learned).length;
    const masterCnt = Object.keys(mastered).length;
    const favCnt = favorites.length;
    const diffCnt = difficult.length;
    const errCnt = mistakeBook.length;
    const rate = total > 0 ? (learnCnt / total * 100).toFixed(1) : 0;

    const html = `
        <div class="stat-row">
            <span class="stat-row-label">📚 总单词数</span>
            <span class="stat-row-value">${total}</span>
        </div>
        <div class="stat-row">
            <span class="stat-row-label">📖 已学习</span>
            <span class="stat-row-value">${learnCnt} <span style="font-size:0.85rem; color:var(--text-muted);">(${rate}%)</span></span>
        </div>
        <div class="stat-row">
            <span class="stat-row-label">✅ 已掌握</span>
            <span class="stat-row-value" style="color:var(--success);">${masterCnt}</span>
        </div>
        <div class="stat-row">
            <span class="stat-row-label">⭐ 收藏单词</span>
            <span class="stat-row-value" style="color:var(--warning);">${favCnt}</span>
        </div>
        <div class="stat-row">
            <span class="stat-row-label">🤔 标记难词</span>
            <span class="stat-row-value" style="color:var(--danger);">${diffCnt}</span>
        </div>
        <div class="stat-row">
            <span class="stat-row-label">📘 错题数量</span>
            <span class="stat-row-value" style="color:var(--danger);">${errCnt}</span>
        </div>
    `;
    document.getElementById('statContent').innerHTML = html;
}

// ============================================
// Theme Sidebar
// ============================================

function initThemeSidebar() {
    const themes = [
        { id: 1, name: "深海蓝", desc: "清新专业", emoji: "🌊", gradient: "linear-gradient(135deg, #2563eb, #06b6d4)" },
        { id: 2, name: "暮光紫", desc: "优雅神秘", emoji: "🔮", gradient: "linear-gradient(135deg, #7c3aed, #ec4899)" },
        { id: 3, name: "森林绿", desc: "自然活力", emoji: "🌲", gradient: "linear-gradient(135deg, #059669, #84cc16)" },
        { id: 4, name: "暖阳橙", desc: "温暖积极", emoji: "☀️", gradient: "linear-gradient(135deg, #ea580c, #fbbf24)" },
        { id: 5, name: "暗夜黑", desc: "专注沉浸", emoji: "🌙", gradient: "linear-gradient(135deg, #60a5fa, #3b82f6)" }
    ];

    document.getElementById('themeList').innerHTML = themes.map(t => `
        <div class="theme-option" onclick="setTheme(${t.id})">
            <div class="theme-option-icon" style="background:${t.gradient}">${t.emoji}</div>
            <div class="theme-option-info">
                <div class="theme-option-name">${t.name}</div>
                <div class="theme-option-desc">${t.desc}</div>
            </div>
        </div>
    `).join('');
}

// ============================================
// Event Delegation & Bindings
// ============================================

document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-sentence]');
    if (target) {
        const sentence = target.dataset.sentence;
        readExampleSentence(sentence);
    }
});

document.getElementById('themeToggleBtn').onclick = () => {
    initThemeSidebar();
    document.getElementById('themePanel').classList.add('open');
    document.getElementById('overlay').classList.add('show');
};

document.getElementById('mistakeBtn').onclick = () => {
    renderMistakePanel();
    document.getElementById('mistakePanel').classList.add('open');
    document.getElementById('overlay').classList.add('show');
};

document.getElementById('settingBtn').onclick = () => {
    document.getElementById('settingPanel').classList.add('open');
    document.getElementById('overlay').classList.add('show');
};

document.getElementById('statBtn').onclick = () => {
    renderStatPanel();
    document.getElementById('statPanel').classList.add('open');
    document.getElementById('overlay').classList.add('show');
};

document.getElementById('listBtn').onclick = () => renderWordList();
document.getElementById('homeBtn').onclick = () => goHome();
document.getElementById('reviewMistakesBtn').onclick = () => { closePanels(); openMistakeReview(); };

// Global function exports
window.goHome = goHome;
window.closePanels = closePanels;
window.setTheme = setTheme;
window.startClassic = startClassic;
window.startQuiz = startQuiz;
window.randomChallenge = randomChallenge;
window.openMistakeReview = openMistakeReview;
window.checkAnswer = checkAnswer;
window.nextQuiz = nextQuiz;
window.retryMistake = retryMistake;
window.playWordAudio = playWordAudio;
window.readExampleSentence = readExampleSentence;
window.jumpToWord = jumpToWord;
window.filterList = filterList;
window.startDictation = startDictation;
window.checkDictation = checkDictation;
window.startSmartReview = startSmartReview;
window.toggleMeanMask = toggleMeanMask;
window.toggleTransMask = toggleTransMask;
window.doSearch = doSearch;
window.clearAllMistake = clearAllMistake;

// ============================================
// Word Data Loading
// ============================================

async function loadWords() {
    const paths = [
        'toefl_vocabulary.json',
        './toefl_vocabulary.json',
        '../toefl_vocabulary.json',
        'data/toefl_vocabulary.json'
    ];

    let loaded = false;
    for (const p of paths) {
        try {
            const res = await fetch(p, { cache: 'no-store' });
            if (res.ok) {
                words = await res.json();
                loaded = true;
                console.log(`✅ Loaded: ${p}, ${words.length} words`);
                break;
            }
        } catch (e) {
            console.warn(`❌ Failed: ${p}`, e);
        }
    }

    if (!loaded || !words.length) {
        document.getElementById('main').innerHTML = `
            <div class="card-base" style="text-align:center; padding:48px 24px;">
                <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
                <h3 style="margin-bottom:12px;">单词库加载失败</h3>
                <p style="color:var(--text-muted); margin-bottom:24px;">请确保 <strong>toefl_vocabulary.json</strong> 与本文件同目录</p>
                <button class="btn btn-primary" onclick="location.reload()">🔄 重新加载</button>
            </div>`;
        return;
    }

    loadData();
    const savedTheme = localStorage.getItem(STORAGE.theme) || '1';
    applyTheme(parseInt(savedTheme));
    refreshParticles();
    renderHome();
    showToast(`🎉 欢迎回来！已加载 ${words.length} 个单词`);
}

// Start the app
loadWords();

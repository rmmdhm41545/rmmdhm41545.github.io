(function() {
    // ========== Supabase 配置（改成你自己的） ==========
    const SUPABASE_URL = 'https://bignhwmpjnplzksokzif.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpZ25od21wam5wbHprc29remlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTI1NTAsImV4cCI6MjEwNTM4ODU1MH0.FlZRCL5FlT3X1AVIKt02CLoK8CqF8Lja8YAk1f2reL4';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ========== DOM 元素 ==========
    const splashScreen = document.getElementById('splashScreen');
    const splashBtn = document.getElementById('splashBtn');
    const gameContainer = document.getElementById('gameContainer');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBarFill = document.getElementById('timerBarFill');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const comboNum = document.getElementById('comboNum');
    const comboWrap = document.getElementById('comboWrap');
    const feedback = document.getElementById('feedback');
    const inputField = document.getElementById('inputField');
    const endOverlay = document.getElementById('endOverlay');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const restartBtn = document.getElementById('restartBtn');
    const themeBtn = document.getElementById('themeBtn');
    const finalScore = document.getElementById('finalScore');
    const finalMessage = document.getElementById('finalMessage');
    const finalCorrect = document.getElementById('finalCorrect');
    const finalError = document.getElementById('finalError');
    const finalMaxCombo = document.getElementById('finalMaxCombo');
    const particlesContainer = document.getElementById('particles');
    const playerName = document.getElementById('playerName');
    const leaderboardList = document.getElementById('leaderboardList');

    // ========== 游戏常量与状态 ==========
    const GAME_DURATION = 60;
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let correctCount = 0;
    let errorCount = 0;
    let timeRemaining = GAME_DURATION;
    let isPlaying = false;
    let animationId = null;
    let lastTimestamp = null;
    let feedbackTimeout = null;
    let lastTickSecond = GAME_DURATION;
    let currentRecordId = null;

    // ========== 音频系统 ==========
    let audioCtx = null;

    function initAudio() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        } catch (e) {
            console.warn('无法初始化音频上下文', e);
        }
    }

    function playTone(freq, duration, type = 'sine', volume = 0.3, delay = 0) {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
            gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + delay);
            osc.stop(audioCtx.currentTime + delay + duration + 0.05);
        } catch (e) {
            console.warn('播放音效失败', e);
        }
    }

    function playCorrectSound() {
        playTone(880, 0.08, 'triangle', 0.3);
        setTimeout(() => playTone(1174.66, 0.06, 'triangle', 0.2, 0.05), 50);
    }

    function playErrorSound() {
        playTone(220, 0.2, 'sawtooth', 0.15);
    }

    function playStartSound() {
        playTone(500, 0.1, 'sine', 0.2);
        setTimeout(() => playTone(700, 0.1, 'sine', 0.2, 0.1), 100);
    }

    function playGameOverSound() {
        playTone(600, 0.2, 'triangle', 0.25);
        setTimeout(() => playTone(400, 0.3, 'triangle', 0.2, 0.2), 200);
    }

    function playTickSound() {
        playTone(1000, 0.03, 'sine', 0.1);
    }

    // ========== 主题 ==========
    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeBtn.textContent = theme === 'dark' ? '暗' : '亮';
        try { localStorage.setItem('mj-theme', theme); } catch (e) {}
    }

    function toggleTheme() {
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    }

    try {
        const saved = localStorage.getItem('mj-theme');
        if (saved === 'light' || saved === 'dark') setTheme(saved);
        else setTheme('dark');
    } catch (e) {
        setTheme('dark');
    }
    themeBtn.addEventListener('click', toggleTheme);

    // ========== 粒子背景 ==========
    function createParticles() {
        const colors = ['#7c3aed', '#ec4899', '#06b6d4', '#8b5cf6', '#f472b6'];
        for (let i = 0; i < 14; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = 30 + Math.random() * 60;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.left = Math.random() * 100 + '%';
            p.style.background = `radial-gradient(circle, ${colors[i % colors.length]} 0%, transparent 70%)`;
            p.style.animationDuration = (15 + Math.random() * 20) + 's';
            p.style.animationDelay = (-Math.random() * 25) + 's';
            p.style.opacity = 0.2 + Math.random() * 0.4;
            p.style.filter = 'blur(18px)';
            particlesContainer.appendChild(p);
        }
    }
    createParticles();

    // ========== 浮动文字 ==========
    function showFloatText(text, type) {
        const el = document.createElement('div');
        el.className = `float-text ${type}`;
        el.textContent = text;
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight * 0.5;
        const x = 20 + Math.random() * maxX;
        const y = 20 + Math.random() * maxY;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
    }

    // ========== UI 更新 ==========
    function updateUI() {
        scoreDisplay.textContent = score;
        comboNum.textContent = combo;
        comboWrap.classList.toggle('high', combo >= 5);
    }

    function showFeedback(text, type) {
        feedback.textContent = text;
        feedback.className = 'feedback';
        if (type === 'correct') feedback.classList.add('fly-correct');
        else if (type === 'error') feedback.classList.add('fly-error');
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            feedback.className = 'feedback';
            feedback.textContent = '输入 "MJ" 开始得分';
        }, 1000);
    }

    // ========== 在线排行榜 ==========
    async function submitScore(entry) {
        try {
            const { data, error } = await supabase
                .from('scores')
                .insert([entry])
                .select()
                .single();
            if (error) {
                console.warn('提交失败', error);
                return null;
            }
            return data;
        } catch (e) {
            console.warn('提交异常', e);
            return null;
        }
    }

    async function updateScoreName(id, name) {
        if (!id) return;
        try {
            const { error } = await supabase
                .from('scores')
                .update({ name: name })
                .eq('id', id);
            if (error) console.warn('更新名字失败', error);
        } catch (e) {
            console.warn('更新异常', e);
        }
    }

    async function fetchTopScores(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('scores')
                .select('*')
                .order('score', { ascending: false })
                .order('max_combo', { ascending: false })
                .limit(limit);
            if (error) {
                console.warn('读取排行榜失败', error);
                return [];
            }
            return data || [];
        } catch (e) {
            console.warn('读取异常', e);
            return [];
        }
    }

    async function renderOnlineLeaderboard() {
        if (!leaderboardList) return;
        leaderboardList.innerHTML = '<div class="leaderboard-empty">加载中...</div>';
        const list = await fetchTopScores(10);
        if (!list || list.length === 0) {
            leaderboardList.innerHTML = '<div class="leaderboard-empty">暂无记录，快来抢第一！</div>';
            return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        leaderboardList.innerHTML = list.map((item, i) => {
            const rankClass = i < 3 ? ` top-${i + 1}` : '';
            const rankText = i < 3 ? medals[i] : (i + 1);
            const name = escapeHtml(item.name || '匿名玩家');
            return `<div class="leaderboard-item${rankClass}">
                <span class="rank">${rankText}</span>
                <span class="lb-name">${name}</span>
                <span class="lb-detail">连击${item.max_combo}</span>
                <span class="lb-score">${item.score}</span>
            </div>`;
        }).join('');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========== 游戏逻辑 ==========
    function handleCorrect() {
        score += 1;
        correctCount++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        updateUI();
        playCorrectSound();
        scoreDisplay.classList.remove('fly-pop', 'fly-shake');
        void scoreDisplay.offsetWidth;
        scoreDisplay.classList.add('fly-pop');
        comboNum.classList.remove('fly');
        void comboNum.offsetWidth;
        comboNum.classList.add('fly');
        inputField.classList.remove('fly-correct', 'fly-error');
        void inputField.offsetWidth;
        inputField.classList.add('fly-correct');
        showFeedback('正确！+1', 'correct');
        showFloatText('+1', 'positive');
    }

    function handleError() {
        score -= 2;
        errorCount++;
        combo = 0;
        updateUI();
        playErrorSound();
        scoreDisplay.classList.remove('fly-pop', 'fly-shake');
        void scoreDisplay.offsetWidth;
        scoreDisplay.classList.add('fly-shake');
        comboNum.classList.remove('fly');
        void comboNum.offsetWidth;
        comboNum.classList.add('fly');
        inputField.classList.remove('fly-correct', 'fly-error');
        void inputField.offsetWidth;
        inputField.classList.add('fly-error');
        showFeedback('错误！-2', 'error');
        showFloatText('-2', 'negative');
    }

    // ========== 计时器 ==========
    function startTimer() {
        timeRemaining = GAME_DURATION;
        lastTickSecond = GAME_DURATION;
        updateTimerDisplay();
        if (animationId) cancelAnimationFrame(animationId);
        lastTimestamp = null;
        animationId = requestAnimationFrame(tickTimer);
    }

    function tickTimer(timestamp) {
        if (!isPlaying) return;
        if (lastTimestamp === null) {
            lastTimestamp = timestamp;
            animationId = requestAnimationFrame(tickTimer);
            return;
        }
        const delta = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
        timeRemaining -= delta;
        if (timeRemaining <= 0) {
            timeRemaining = 0;
            updateTimerDisplay();
            endGame();
            return;
        }
        updateTimerDisplay();
        animationId = requestAnimationFrame(tickTimer);
    }

    function stopTimer() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        lastTimestamp = null;
    }

    function updateTimerDisplay() {
        const sec = Math.ceil(timeRemaining);
        timerDisplay.textContent = sec;
        const pct = (timeRemaining / GAME_DURATION) * 100;
        timerBarFill.style.width = pct + '%';
        const urgent = timeRemaining <= 10;
        timerDisplay.classList.toggle('urgent', urgent);
        timerBarFill.classList.toggle('urgent', urgent);

        if (isPlaying && sec <= 5 && sec !== lastTickSecond && sec > 0) {
            playTickSound();
            lastTickSecond = sec;
        }
    }

    // ========== 游戏流程 ==========
    function startGame() {
        initAudio();
        playStartSound();
        score = 0;
        combo = 0;
        maxCombo = 0;
        correctCount = 0;
        errorCount = 0;
        timeRemaining = GAME_DURATION;
        lastTickSecond = GAME_DURATION;
        currentRecordId = null;
        isPlaying = true;
        updateUI();
        updateTimerDisplay();
        feedback.className = 'feedback';
        feedback.textContent = '输入 "MJ" 开始得分';
        inputField.disabled = false;
        inputField.value = '';
        inputField.focus();
        endOverlay.classList.remove('active');
        restartBtn.style.display = 'block';
        startTimer();
    }

    function endGame() {
        isPlaying = false;
        stopTimer();
        playGameOverSound();
        inputField.disabled = true;
        inputField.value = '';

        finalScore.textContent = score;
        finalCorrect.textContent = correctCount;
        finalError.textContent = errorCount;
        finalMaxCombo.textContent = maxCombo;

        if (score >= 40) finalMessage.textContent = '你是MJ大师！';
        else if (score >= 25) finalMessage.textContent = '节奏感超强！';
        else if (score >= 15) finalMessage.textContent = '不错的成绩！';
        else if (score >= 5) finalMessage.textContent = '继续练习！';
        else if (score >= 0) finalMessage.textContent = '刚刚起步！';
        else finalMessage.textContent = '再试一次吧！';

        // 恢复上次用的名字
        try {
            const savedName = localStorage.getItem('mj-player-name');
            if (savedName) playerName.value = savedName;
        } catch (e) {}

        endOverlay.classList.add('active');
        restartBtn.style.display = 'none';

        // 提交成绩
        const name = (playerName.value || '').trim() || '匿名玩家';
        try { localStorage.setItem('mj-player-name', name); } catch (e) {}

        submitScore({
            name: name,
            score: score,
            correct: correctCount,
            error: errorCount,
            max_combo: maxCombo
        }).then((record) => {
            if (record && record.id) currentRecordId = record.id;
            renderOnlineLeaderboard();
        });
    }

    function resetAndStart() {
        stopTimer();
        isPlaying = false;
        score = 0;
        combo = 0;
        maxCombo = 0;
        correctCount = 0;
        errorCount = 0;
        timeRemaining = GAME_DURATION;
        currentRecordId = null;
        updateUI();
        updateTimerDisplay();
        feedback.className = 'feedback';
        feedback.textContent = '输入 "MJ" 开始得分';
        inputField.disabled = true;
        inputField.value = '';
        endOverlay.classList.remove('active');
        restartBtn.style.display = 'none';
        startGame();
    }

    // ========== 事件监听 ==========
    splashBtn.addEventListener('click', function() {
        splashScreen.classList.add('hidden');
        gameContainer.classList.add('visible');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 600);
        startGame();
        setTimeout(() => {
            if (isPlaying) inputField.focus();
        }, 1100);
    });

    inputField.addEventListener('input', function() {
        if (!isPlaying) return;
        const val = inputField.value.trim().toLowerCase();
        if (val === 'mj') {
            handleCorrect();
            inputField.value = '';
        } else if (val.length >= 3) {
            handleError();
            inputField.value = '';
        }
    });

    inputField.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!isPlaying) return;
            const val = inputField.value.trim().toLowerCase();
            if (val === 'mj') handleCorrect();
            else if (val.length > 0) handleError();
            inputField.value = '';
        }
    });

    document.getElementById('card').addEventListener('click', function(e) {
        if (isPlaying && !e.target.closest('.input-field') && !e.target.closest('.btn') && !e.target.closest('.theme-btn') && !e.target.closest('.name-input') && !e.target.closest('.leaderboard')) {
            inputField.focus();
        }
    });

    playAgainBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', resetAndStart);

    // 名字改变时更新刚才提交的那条记录
    let nameUpdateTimeout = null;
    playerName.addEventListener('input', function() {
        const name = (playerName.value || '').trim() || '匿名玩家';
        try { localStorage.setItem('mj-player-name', name); } catch (e) {}

        if (nameUpdateTimeout) clearTimeout(nameUpdateTimeout);
        nameUpdateTimeout = setTimeout(async () => {
            if (currentRecordId) {
                await updateScoreName(currentRecordId, name);
                renderOnlineLeaderboard();
            }
        }, 700);
    });

    document.addEventListener('keydown', function(e) {
        if (e.target === playerName || e.target === inputField) return;
        if (e.key === ' ' && !isPlaying && gameContainer.classList.contains('visible')) {
            e.preventDefault();
            if (endOverlay.classList.contains('active')) {
                startGame();
            }
        }
    });

    // ========== 初始化 ==========
    updateUI();
    updateTimerDisplay();
    inputField.disabled = true;
    restartBtn.style.display = 'none';
    gameContainer.classList.remove('visible');

    // 预加载排行榜（可选）
    fetchTopScores(10).then(list => {
        if (list && list.length > 0) {
            // 静默缓存，等结束界面再渲染
        }
    });
})();
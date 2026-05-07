const BAGUA = ["☰ 乾", "☱ 兌", "☲ 離", "☳ 震", "☴ 巽", "☵ 坎", "☶ 艮", "☷ 坤"];
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const L_MONTHS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "臘月"];
const L_DAYS = ["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const SOLAR_TERMS = ["小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "穀雨", "立夏", "小滿", "芒種", "夏至", "小暑", "大暑", "立秋", "處暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"];
const TERM_INFO = [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];

const config = [
    { type: 'bagua',  data: BAGUA,    radius: 'bagua' },
    { type: 'stem',   data: STEMS,    radius: 'stem' },
    { type: 'branch', data: BRANCHES, radius: 'branch' },
    { type: 'hour',   data: Array.from({length: 12}, (_, i) => (i===0 ? 12 : i) + "時"), radius: 'hour' }, 
    { type: 'minute', data: Array.from({length: 60}, (_, i) => i + "分"), radius: 'minute' },
    { type: 'second', data: Array.from({length: 60}, (_, i) => i + "秒"), radius: 'second' }
];

let currentAngles = { bagua: 0, stem: 0, branch: 0, hour: 0, minute: 0, second: 0 };
let lastIndices = { bagua: -1, stem: -1, branch: -1, hour: -1, minute: -1, second: -1 };
let isLunarFormat = false; 
let ntpOffsetMs = 0; 
let hideTimer = null; 

const BASE_WINDOW_SIZE = 950;

function updateScaleFromWindow() {
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const slider = document.getElementById('scale-range');
    const internalZoom = slider ? parseFloat(slider.value) : 1;
    const scale = (minDim / BASE_WINDOW_SIZE) * internalZoom;
    document.documentElement.style.setProperty('--ui-scale', scale);
}

function resetHideTimer() {
    clearTimeout(hideTimer);
    document.body.classList.remove('hide-ui');
    const autoHide = document.getElementById('auto-hide-toggle').checked;
    const isSettingsOpen = document.getElementById('settings-panel').classList.contains('show');
    if (autoHide && !isSettingsOpen) {
        hideTimer = setTimeout(() => { document.body.classList.add('hide-ui'); }, 3000); 
    }
}

function init() {
    const compass = document.getElementById('compass');
    config.forEach(conf => {
        const ring = document.createElement('div');
        ring.className = `ring ring-${conf.radius}`;
        conf.data.forEach((text, i) => {
            const label = document.createElement('div');
            label.className = `label label-${conf.type}-${i}`;
            label.style.transform = `rotate(${i * (360 / conf.data.length)}deg)`;
            label.innerText = text;
            ring.appendChild(label);
        });
        compass.appendChild(ring);
    });
    updateScaleFromWindow();
    window.addEventListener('resize', updateScaleFromWindow);
    document.addEventListener('touchstart', resetHideTimer, {passive: true});
    document.addEventListener('mousemove', resetHideTimer);
    document.getElementById('btn-settings').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('settings-panel').classList.add('show');
        resetHideTimer();
    });
    document.getElementById('close-panel').addEventListener('click', () => {
        document.getElementById('settings-panel').classList.remove('show');
        resetHideTimer();
    });
    document.getElementById('date-info').addEventListener('click', (e) => {
        e.stopPropagation();
        isLunarFormat = !isLunarFormat;
        update(); 
    });
    document.getElementById('scale-range').addEventListener('input', updateScaleFromWindow);
    document.getElementById('opacity-range').addEventListener('input', e => document.documentElement.style.setProperty('--bg-opacity', e.target.value));
    syncWithHttpTime();
}

async function syncWithHttpTime() {
    const apiEndpoints = ['https://worldtimeapi.org/api/timezone/Etc/UTC', 'https://timeapi.io/api/Time/current/zone?timeZone=UTC'];
    for (let url of apiEndpoints) {
        try {
            const start = Date.now();
            const response = await fetch(url);
            if (!response.ok) throw new Error();
            const data = await response.json();
            const end = Date.now();
            const delay = (end - start) / 2;
            let serverTime = new Date(data.utc_datetime || data.dateTime + "Z").getTime() + delay;
            ntpOffsetMs = serverTime - Date.now(); 
            document.getElementById('ntp-status').innerText = `網路時間: 🌐 已同步 (誤差 ${Math.round(ntpOffsetMs)}ms)`;
            return; 
        } catch (e) {}
    }
    document.getElementById('ntp-status').innerText = "網路時間: 📶 離線模式";
}

// 核心修正：統一獲取當前精準時間點
function getNow() {
    const tzOffsetHours = parseFloat(document.getElementById('tz-select').value);
    const trueUtcMs = Date.now() + ntpOffsetMs; 
    const systemOffsetMs = new Date().getTimezoneOffset() * 60000; 
    return new Date(trueUtcMs + systemOffsetMs + (tzOffsetHours * 3600000));
}

function getLunar(targetDate) {
    const pseudoUtc = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 12, 0, 0));
    let yIdx = (pseudoUtc.getUTCFullYear() - 1984 + 600) % 60; 
    let mIdx = pseudoUtc.getUTCMonth(); 
    let dIdx = pseudoUtc.getUTCDate() - 1;
    try {
        const parts = new Intl.DateTimeFormat('en-US-u-ca-chinese', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).formatToParts(pseudoUtc);
        parts.forEach(p => {
            if (p.type === 'month') mIdx = parseInt(p.value) - 1;
            if (p.type === 'day') dIdx = parseInt(p.value) - 1;
        });
    } catch (e) {}
    return { yIdx, mIdx, dIdx };
}

function getCurrentSolarTerm(targetDate) {
    const y = targetDate.getFullYear();
    let termIdx = -1;
    for (let i = 0; i < 24; i++) {
        const termDate = new Date(Date.UTC(1900, 0, 6, 2, 5, 0) + 31556925974.7 * (y - 1900) + TERM_INFO[i] * 60000);
        if (targetDate.getTime() >= termDate.getTime()) termIdx = i;
        else break;
    }
    return SOLAR_TERMS[termIdx === -1 ? 23 : termIdx];
}

function update() {
    const now = getNow(); // 所有的計算都基於同一個 now 物件
    const lunar = getLunar(now);
    const h24 = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    
    // 傳統時辰計算 (每2小時一個時辰，子時從 23:00 開始)
    const shichenIdx = Math.floor((h24 + 1) % 24 / 2);
    const isZheng = (h24 % 2 === 0); // 偶數小時為「正」，奇數小時為「初」
    const keIdx = Math.floor(m / 15);
    const keNames = ["初刻", "一刻", "二刻", "三刻"];

    const nowValues = {
        bagua: h24 % 8,
        stem: lunar.yIdx % 10,
        branch: shichenIdx, 
        hour: h24 % 12, 
        minute: m,
        second: s
    };

    config.forEach(conf => {
        const ring = document.querySelector(`.ring-${conf.radius}`);
        const targetIdx = nowValues[conf.type];
        const step = 360 / conf.data.length;
        if (targetIdx !== lastIndices[conf.type]) {
            if (lastIndices[conf.type] !== -1) {
                let diff = targetIdx - lastIndices[conf.type];
                if (diff < 0) diff += conf.data.length; 
                currentAngles[conf.type] -= (diff * step);
            } else {
                currentAngles[conf.type] = -targetIdx * step;
            }
            ring.style.transform = `rotate(${currentAngles[conf.type]}deg)`;
            lastIndices[conf.type] = targetIdx;
            ring.querySelectorAll('.label').forEach(l => l.classList.remove('active'));
            const activeLabel = ring.querySelector(`.label-${conf.type}-${targetIdx}`);
            if (activeLabel) activeLabel.classList.add('active');
        }
    });

    const timeStr = `${h24 >= 12 ? '下午' : '上午'} ${(h24 % 12 || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const dateDisplay = document.getElementById('date-info');
    const term = getCurrentSolarTerm(now);

    if (isLunarFormat) {
        dateDisplay.innerText = `農曆 ${STEMS[lunar.yIdx % 10]}${BRANCHES[lunar.yIdx % 12]}年 ${L_MONTHS[lunar.mIdx]}${L_DAYS[lunar.dIdx]} 【${term}】 ｜ ${BRANCHES[shichenIdx]}時${isZheng ? '正' : '初'}${keNames[keIdx]}`;
    } else {
        dateDisplay.innerText = `西元 ${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]} 【${term}】 ｜ ${timeStr}`;
    }
}

init();
setInterval(update, 1000);
update();

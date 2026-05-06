const BAGUA = ["☰ 乾", "☱ 兌", "☲ 離", "☳ 震", "☴ 巽", "☵ 坎", "☶ 艮", "☷ 坤"];
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const L_MONTHS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "臘月"];
const L_DAYS = ["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

// 24節氣名稱與高精度太陽黃經偏移常數
const SOLAR_TERMS = ["小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "穀雨", "立夏", "小滿", "芒種", "夏至", "小暑", "大暑", "立秋", "處暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"];
const TERM_INFO = [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];

const L_YEARS = [];
for(let i=0; i<60; i++) L_YEARS.push(STEMS[i%10] + BRANCHES[i%12] + "年");

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
let hideTimer = null; // 手機版隱藏按鈕的計時器

// 手機版基準寬度較小，以適應直立螢幕
const BASE_WINDOW_SIZE = 950;

function updateScaleFromWindow() {
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const slider = document.getElementById('scale-range');
    const internalZoom = slider ? parseFloat(slider.value) : 1;
    
    const scale = (minDim / BASE_WINDOW_SIZE) * internalZoom;
    document.documentElement.style.setProperty('--ui-scale', scale);
}

// 手機版：點擊螢幕顯示按鈕，3秒後自動隱藏
function resetHideTimer() {
    clearTimeout(hideTimer);
    document.body.classList.remove('hide-ui');
    
    const autoHide = document.getElementById('auto-hide-toggle').checked;
    const isSettingsOpen = document.getElementById('settings-panel').classList.contains('show');
    
    // 如果設定面板打開，或關閉了自動隱藏，就不隱藏
    if (autoHide && !isSettingsOpen) {
        hideTimer = setTimeout(() => {
            document.body.classList.add('hide-ui');
        }, 3000); // 3秒後隱藏
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

    // 觸控螢幕任一處，喚醒 UI
    document.addEventListener('touchstart', resetHideTimer);
    document.addEventListener('mousemove', resetHideTimer);

    // 面板開關
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

    const scaleSlider = document.getElementById('scale-range');
    scaleSlider.addEventListener('input', e => {
        document.documentElement.style.setProperty('--ui-scale', parseFloat(e.target.value));
    });

    document.getElementById('opacity-range').addEventListener('input', e => document.documentElement.style.setProperty('--bg-opacity', e.target.value));
    document.getElementById('auto-hide-toggle').addEventListener('change', resetHideTimer);

    syncWithHttpTime();
    resetHideTimer();
}

// 手機支援的 HTTP 精準網路對時
async function syncWithHttpTime() {
    try {
        const start = Date.now();
        const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
        const data = await response.json();
        const end = Date.now();
        
        const delay = (end - start) / 2;
        const serverTime = new Date(data.utc_datetime).getTime() + delay;
        
        ntpOffsetMs = serverTime - Date.now(); 
        document.getElementById('ntp-status').innerText = `網路時間: 已同步 (誤差 ${Math.round(ntpOffsetMs)}ms)`;
    } catch (error) {
        document.getElementById('ntp-status').innerText = "網路時間: 離線，使用手機系統時間";
        document.getElementById('ntp-status').style.color = "#f87171";
    }
}

function getAccurateDate() {
    const tzOffsetHours = parseFloat(document.getElementById('tz-select').value);
    const trueUtcMs = Date.now() + ntpOffsetMs; 
    const systemOffsetMs = new Date().getTimezoneOffset() * 60000; 
    const targetLocalMs = trueUtcMs + systemOffsetMs + (tzOffsetHours * 3600000);
    return new Date(targetLocalMs);
}

function getLunar(targetDate) {
    let yIdx = (targetDate.getUTCFullYear() - 1984 + 600) % 60; 
    let mIdx = targetDate.getUTCMonth(); 
    let dIdx = targetDate.getUTCDate() - 1;
    try {
        const str = new Intl.DateTimeFormat('en-US-u-ca-chinese', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).format(targetDate);
        const parts = str.match(/\d+/g);
        if (parts && parts.length >= 2) {
            mIdx = parseInt(parts[0]) - 1;
            dIdx = parseInt(parts[1]) - 1;
        }
    } catch (e) {}
    return { yIdx: isNaN(yIdx) ? 0 : yIdx, mIdx: isNaN(mIdx) ? 0 : mIdx, dIdx: isNaN(dIdx) ? 0 : dIdx };
}

function getCurrentSolarTerm(targetDate) {
    const y = targetDate.getFullYear();
    let termIdx = -1;
    for (let i = 0; i < 24; i++) {
        const termDate = new Date(Date.UTC(1900, 0, 6, 2, 5, 0) + 31556925974.7 * (y - 1900) + TERM_INFO[i] * 60000);
        if (targetDate.getTime() >= termDate.getTime()) {
            termIdx = i;
        } else {
            break;
        }
    }
    if (termIdx === -1) return "冬至"; 
    return SOLAR_TERMS[termIdx];
}

function update() {
    const displayDate = getAccurateDate();
    const lunar = getLunar(displayDate);
    const hour24 = displayDate.getHours();
    
    const currentTerm = getCurrentSolarTerm(displayDate);
    const shichenIdx = Math.floor((hour24 + 1) % 24 / 2);
    
    const nowValues = {
        bagua: hour24 % 8,
        stem: lunar.yIdx % 10,
        branch: shichenIdx, 
        hour: hour24 % 12, 
        minute: displayDate.getMinutes(),
        second: displayDate.getSeconds()
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

    const ampm = hour24 >= 12 ? '下午' : '上午';
    const h12 = hour24 % 12 || 12;
    const timeStr = `${ampm} ${h12.toString().padStart(2, '0')}:${displayDate.getMinutes().toString().padStart(2, '0')}:${displayDate.getSeconds().toString().padStart(2, '0')}`;

    const dateDisplay = document.getElementById('date-info');
    if (isLunarFormat) {
        const stemStr = STEMS[lunar.yIdx % 10];
        const branchStr = BRANCHES[lunar.yIdx % 12];
        const isZheng = (hour24 % 2 === 0); 
        const keIdx = Math.floor(displayDate.getMinutes() / 15); 
        const keNames = ["初刻", "一刻", "二刻", "三刻"];
        const traditionalTime = BRANCHES[shichenIdx] + "時" + (isZheng ? "正" : "初") + keNames[keIdx];

        dateDisplay.innerText = `農曆 ${stemStr}${branchStr}年 ${L_MONTHS[lunar.mIdx]}${L_DAYS[lunar.dIdx]} 【${currentTerm}】 ｜ ${traditionalTime}`;
    } else {
        dateDisplay.innerText = `西元 ${displayDate.getFullYear()}年${displayDate.getMonth()+1}月${displayDate.getDate()}日 ${WEEKDAYS[displayDate.getDay()]} 【${currentTerm}】 ｜ ${timeStr}`;
    }
}

init();
setInterval(update, 1000);
update();
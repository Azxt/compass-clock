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

function getAccurateNow() {
    const tzOffsetHours = parseFloat(document.getElementById('tz-select') ? document.getElementById('tz-select').value : 8);
    const trueUtcMs = Date.now() + ntpOffsetMs; 
    const systemOffsetMs = new Date().getTimezoneOffset() * 60000; 
    return new Date(trueUtcMs + systemOffsetMs + (tzOffsetHours * 3600000));
}

// --- 核心修復：農曆子時換日邏輯 ---
function getLunarData(targetDate) {
    let checkDate = new Date(targetDate.getTime());
    
    // 如果現在是 23:00 之後，農曆日期應算作「隔天」
    if (checkDate.getHours() >= 23) {
        checkDate.setDate(checkDate.getDate() + 1);
    }

    // 使用正午 12 點作為計算基準，避開時差邊界誤差
    const pseudoUtc = new Date(Date.UTC(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 12, 0, 0));
    
    let mIdx = 0, dIdx = 0;
    try {
        const parts = new Intl.DateTimeFormat('en-US-u-ca-chinese', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).formatToParts(pseudoUtc);
        parts.forEach(p => {
            if (p.type === 'month') mIdx = parseInt(p.value) - 1;
            if (p.type === 'day') dIdx = parseInt(p.value) - 1;
        });
    } catch (e) {}

    // 年分天干地支計算（以立春或正月初一為準有不同說法，此處採標準農曆年換算）
    let yIdx = (checkDate.getFullYear() - 1984 + 600) % 60;
    
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
    const now = getAccurateNow(); 
    const h24 = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    
    // 計算農曆（含子時換日修復）
    const lunar = getLunarData(now);
    
    // 傳統時辰：子時(23-1), 丑時(1-3)...
    const shichenIdx = Math.floor((h24 + 1) % 24 / 2);
    const isZheng = (h24 % 2 === 0); 
    const keNames = ["初刻", "一刻", "二刻", "三刻"];
    const keIdx = Math.floor(m / 15);

    const nowValues = {
        bagua: h24 % 8,
        stem: lunar.yIdx % 10,
        branch: shichenIdx, 
        hour: h24 % 12, 
        minute: m,
        second: s
    };

    // 更新羅盤
    config.forEach(conf => {
        const ring = document.querySelector(`.ring-${conf.radius}`);
        if (!ring) return;
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

    // 更新文字
    const dateDisplay = document.getElementById('date-info');
    if (!dateDisplay) return;
    const term = getCurrentSolarTerm(now);

    if (isLunarFormat) {
        dateDisplay.innerText = `農曆 ${STEMS[lunar.yIdx % 10]}${BRANCHES[lunar.yIdx % 12]}年 ${L_MONTHS[lunar.mIdx]}${L_DAYS[lunar.dIdx]} 【${term}】 ｜ ${BRANCHES[shichenIdx]}時${isZheng ? '正' : '初'}${keNames[keIdx]}`;
    } else {
        const timeStr = `${h24 >= 12 ? '下午' : '上午'} ${(h24 % 12 || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        dateDisplay.innerText = `西元 ${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]} 【${term}】 ｜ ${timeStr}`;
    }
}

// 網路對時、初始化等其餘邏輯保持不變...
init(); // 確保 index.html 有呼叫 init
setInterval(update, 1000);
update();

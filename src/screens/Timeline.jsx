// الشاشة 4: الخط الزمني.
// الأرقام الحين ثابتة: رصيد أحمد ونصابه أسبوعيًا، وأحداثه، من تشغيل المحرك.
// يوم الأربعاء نستبدل POINTS و EVENTS بمخرجات المحرك (series و events) يومًا بيوم.
import { useState } from 'react';
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import ZakatHeader from '../components/ZakatHeader.jsx';

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, annotationPlugin);

// [التاريخ، الرصيد، النصاب] كل أسبوع
const POINTS = [["2025-04-01",1934,2417],["2025-04-08",1750,2139],["2025-04-15",1568,2319],["2025-04-22",1287,2332],["2025-04-29",14103,2363],["2025-05-06",8981,2383],["2025-05-13",7462,2361],["2025-05-20",5508,2374],["2025-05-27",16986,2386],["2025-06-03",11505,2477],["2025-06-10",9228,2621],["2025-06-17",7017,2664],["2025-06-24",5168,2577],["2025-07-01",13799,2585],["2025-07-08",12373,2637],["2025-07-15",10749,2705],["2025-07-22",8629,2819],["2025-07-29",20878,2741],["2025-08-05",15663,2713],["2025-08-12",14003,2720],["2025-08-19",12476,2682],["2025-08-26",10653,2770],["2025-09-02",19268,2921],["2025-09-09",17711,2932],["2025-09-16",15940,3053],["2025-09-23",14388,3159],["2025-09-30",26689,3346],["2025-10-07",21488,3431],["2025-10-14",30530,3693],["2025-10-21",28924,3493],["2025-10-28",40824,3377],["2025-11-04",34833,3384],["2025-11-11",32956,3675],["2025-11-18",30219,3637],["2025-11-25",28217,3693],["2025-12-02",36853,4193],["2025-12-09",35426,4352],["2025-12-16",33925,4573],["2025-12-23",31647,5127],["2025-12-30",43879,5470],["2026-01-06",38401,5828],["2026-01-13",36393,6236],["2026-01-20",34307,6769],["2026-01-27",46059,8028],["2026-02-03",41013,6121],["2026-02-10",38669,5795],["2026-02-17",36539,5499],["2026-02-24",35027,6254],["2026-03-03",43797,5885],["2026-03-10",41687,6337],["2026-03-17",40410,5688],["2026-03-24",38410,5110],["2026-03-31",50462,5390],["2026-04-07",44593,5233],["2026-04-14",43263,5708],["2026-04-21",41322,5503],["2026-04-28",53285,5245],["2026-05-05",48847,5224],["2026-05-12",47207,6209],["2026-05-19",46052,5287],["2026-05-26",45206,5602],["2026-06-02",54612,5389],["2026-06-09",52379,4688],["2026-06-16",49929,5023],["2026-06-23",47710,4416],["2026-06-30",59839,4203],["2026-07-07",55165,4303],["2026-07-14",52810,4211],["2026-07-21",51326,4218],["2026-07-28",64139,4097],["2026-08-04",58899,4270],["2026-08-11",57081,4640],["2026-08-18",55483,4543],["2026-08-25",53868,4926],["2026-09-01",62838,4597],["2026-09-08",61271,4717],["2026-09-15",59415,4568],["2026-09-22",58609,4811],["2026-09-29",70659,4613],["2026-10-03",66323,4613]];

const EVENTS = [
  { type: 'START', date: '2025-04-27', hijri: '29 شوال 1446',
    text: 'بلغ مجموع أموالك 14,642 ريالًا يوم 27 أبريل 2025، وتجاوز النصاب (2,374 ريالًا بسعر الفضة ذلك اليوم)، فبدأ الحول.' },
  { type: 'DUE', date: '2026-04-17', hijri: '29 شوال 1447', base: 3366, zakat: 84.15 },
  { type: 'DUE', date: '2026-05-16', hijri: '29 ذو القعدة 1447', base: 1262, zakat: 31.55 },
  { type: 'DUE', date: '2026-06-17', hijri: '2 محرم 1448', base: 3051, zakat: 76.28 },
  { type: 'DUE', date: '2026-07-16', hijri: '2 صفر 1448', base: 2974, zakat: 74.35 },
  { type: 'DUE', date: '2026-08-17', hijri: '4 ربيع الأول 1448', base: 3110, zakat: 77.75 },
  { type: 'DUE', date: '2026-09-16', hijri: '5 ربيع الآخر 1448', base: 6875, zakat: 171.88 },
  { type: 'DUE', date: '2026-10-03', hijri: '22 ربيع الآخر 1448', base: 6614, zakat: 165.35 },
];

const STYLE = {
  START: { color: '#4CC38A', label: 'بداية الحول', pointStyle: 'circle', radius: 8 },
  BREAK: { color: '#FF7A7A', label: 'انقطاع', pointStyle: 'crossRot', radius: 8 },
  DUE: { color: '#E8C46A', label: 'وجوب', pointStyle: 'rectRot', radius: 7 },
};

const money = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const labels = POINTS.map(p => p[0]);

// النقاط أسبوعية، فنربط كل حدث بأقرب أسبوع له
function nearestIndex(date) {
  const t = Date.parse(date);
  let best = 0;
  labels.forEach((l, i) => { if (Math.abs(Date.parse(l) - t) < Math.abs(Date.parse(labels[best]) - t)) best = i; });
  return best;
}

function explain(e) {
  if (e.text) return e.text;
  return `حال الحول على ${money(e.base)} ريال يوم ${e.hijri}، فوجبت زكاته: ${money(e.zakat)} ريال (ربع العشر).`;
}

export default function Timeline({ go }) {
  const [selected, setSelected] = useState(0);
  const sel = EVENTS[selected];
  const firstDue = EVENTS.find(e => e.type === 'DUE');

  const annotations = {
    hawl: {
      type: 'box',
      xMin: nearestIndex(EVENTS[0].date), xMax: nearestIndex(firstDue.date),
      backgroundColor: 'rgba(248,160,147,0.12)', borderWidth: 0,
    },
  };
  EVENTS.forEach((e, i) => {
    const idx = nearestIndex(e.date);
    const s = STYLE[e.type];
    annotations['e' + i] = {
      type: 'point',
      xValue: idx, yValue: POINTS[idx][1],
      pointStyle: s.pointStyle, radius: selected === i ? s.radius + 3 : s.radius,
      backgroundColor: s.color, borderColor: '#002134', borderWidth: 2,
      click: () => setSelected(i),
    };
  });

  const data = {
    labels,
    datasets: [
      { label: 'الرصيد', data: POINTS.map(p => p[1]), borderColor: '#FFFFFF', borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: 'النصاب', data: POINTS.map(p => p[2]), borderColor: '#A9BCC8', borderWidth: 1.6, borderDash: [5, 4], pointRadius: 0 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: { top: 12, right: 12, left: 8 } },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { display: false },
      y: { display: true, beginAtZero: true, ticks: { display: false }, grid: { color: '#0B4A70' }, border: { display: false } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        rtl: true, textDirection: 'rtl',
        callbacks: { label: c => `${c.dataset.label}: ${money(c.parsed.y)} ريال` },
      },
      annotation: { annotations },
    },
  };

  return (
    <>
      <ZakatHeader active="timeline" go={go} />
      <div className="screen">

        <div className="card" style={{ padding: '12px 8px 8px' }}>
          <div className="row small soft" style={{ padding: '0 10px 6px' }}>
            <span>أحمد · آخر 18 شهرًا</span>
            <span>الرصيد {money(POINTS.at(-1)[1])} ريال</span>
          </div>
          <div style={{ height: 220 }}>
            <Line data={data} options={options} aria-label="رسم رصيد أحمد مقابل النصاب" />
          </div>
          <div dir="ltr" className="row small muted" style={{ padding: '4px 10px 0' }}>
            <span>أبريل 2025</span><span>يناير 2026</span><span>أكتوبر 2026</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }} className="small soft">
          <Legend line="#FFFFFF">الرصيد</Legend>
          <Legend line="#A9BCC8" dashed>النصاب</Legend>
          <Legend dot="#4CC38A">بداية الحول</Legend>
          <Legend dot="#FF7A7A">انقطاع</Legend>
          <Legend dot="#E8C46A" diamond>وجوب</Legend>
        </div>

        <div className="card col" style={{ borderInlineStart: `4px solid ${STYLE[sel.type].color}`, borderRadius: 18, gap: 6, padding: '14px 16px' }}>
          <span className="bold" style={{ fontSize: 14 }}>{STYLE[sel.type].label} · {sel.hijri}</span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#DCE5EB' }}>{explain(sel)}</p>
          <span className="small muted">اضغط أي علامة على الرسم لتقرأ تفسيرها</span>
        </div>

        <button className="btn outline" style={{ height: 48, fontSize: 15 }} onClick={() => go('why')}>لماذا هذا المبلغ؟</button>
      </div>
    </>
  );
}

function Legend({ children, line, dashed, dot, diamond }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {line && (
        <svg width="22" height="10" aria-hidden="true">
          <line x1="1" y1="5" x2="21" y2="5" stroke={line} strokeWidth="2" strokeDasharray={dashed ? '5 4' : undefined} />
        </svg>
      )}
      {dot && (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          {diamond ? <polygon points="7,1 13,7 7,13 1,7" fill={dot} /> : <circle cx="7" cy="7" r="6" fill={dot} />}
        </svg>
      )}
      {children}
    </span>
  );
}
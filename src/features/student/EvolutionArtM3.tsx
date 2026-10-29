import { useId } from 'react'

// ภาพวิวัฒนาการ ม.3 6 ขั้น (SVG ในโค้ด สไตล์เดียวกัน): ลิงน้อย → … → มนุษย์นักเทคโนโลยี
// ทุกขั้นยืนบนเงาพื้นเดียวกัน ตัวละครไล่เฉดให้ดูนูน

const C = {
  fur: '#9a6a44',
  furDark: '#6e4a2e',
  furLight: '#c4936a',
  face: '#f3d6b5',
  eye: '#1b1f33',
  skin: '#f2c9a0',
  skinShade: '#d9a57b',
  hair: '#2a2233',
  tunic: '#e0913a',
  spot: '#8a4f1c',
  stone: '#8c96a8',
  stoneDark: '#5f6878',
  wood: '#8a5a33',
  navy: '#22397a',
  sky: '#38bdf8',
  gold: '#e7b62a',
  goldDark: '#a67a00',
  line: '#d6e2f7',
}

type G = { fur: string; skin: string; glow: string }

function Ground() {
  return <ellipse cx="60" cy="112" rx="28" ry="4.5" fill="#14306a" opacity="0.16" />
}

function MonkeyHead({ cx, cy, r, g }: { cx: number; cy: number; r: number; g: G }) {
  return (
    <g>
      <circle cx={cx - r * 0.95} cy={cy + 1} r={r * 0.38} fill={C.fur} />
      <circle cx={cx + r * 0.95} cy={cy + 1} r={r * 0.38} fill={C.fur} />
      <circle cx={cx - r * 0.95} cy={cy + 1} r={r * 0.22} fill={C.face} />
      <circle cx={cx + r * 0.95} cy={cy + 1} r={r * 0.22} fill={C.face} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${g.fur})`} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.08} r={r * 0.4} fill={C.face} />
      <circle cx={cx + r * 0.3} cy={cy - r * 0.08} r={r * 0.4} fill={C.face} />
      <ellipse cx={cx} cy={cy + r * 0.32} rx={r * 0.62} ry={r * 0.45} fill={C.face} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.1} r={r * 0.13} fill={C.eye} />
      <circle cx={cx + r * 0.3} cy={cy - r * 0.1} r={r * 0.13} fill={C.eye} />
      <circle cx={cx - r * 0.26} cy={cy - r * 0.15} r={r * 0.05} fill="#fff" />
      <circle cx={cx + r * 0.34} cy={cy - r * 0.15} r={r * 0.05} fill="#fff" />
      <circle cx={cx - r * 0.1} cy={cy + r * 0.25} r={r * 0.05} fill={C.furDark} />
      <circle cx={cx + r * 0.1} cy={cy + r * 0.25} r={r * 0.05} fill={C.furDark} />
      <path d={`M${cx - r * 0.22} ${cy + r * 0.45} Q${cx} ${cy + r * 0.62} ${cx + r * 0.22} ${cy + r * 0.45}`} fill="none" stroke={C.furDark} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function HumanHead({ cx, cy, r, g, hair }: { cx: number; cy: number; r: number; g: G; hair: 'messy' | 'neat' }) {
  return (
    <g>
      <circle cx={cx - r * 0.98} cy={cy + 2} r={r * 0.22} fill={C.skinShade} />
      <circle cx={cx + r * 0.98} cy={cy + 2} r={r * 0.22} fill={C.skinShade} />
      {hair === 'messy' && (
        <g fill={C.hair}>
          <circle cx={cx - r * 0.75} cy={cy - r * 0.35} r={r * 0.48} />
          <circle cx={cx - r * 0.3} cy={cy - r * 0.8} r={r * 0.52} />
          <circle cx={cx + r * 0.3} cy={cy - r * 0.82} r={r * 0.52} />
          <circle cx={cx + r * 0.78} cy={cy - r * 0.35} r={r * 0.48} />
        </g>
      )}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${g.skin})`} />
      {hair === 'messy' ? (
        // เคราของมนุษย์ถ้ำ (เว้นช่องปาก)
        <path
          d={`M${cx - r * 0.85} ${cy + r * 0.1} Q${cx - r * 0.7} ${cy + r * 1.25} ${cx} ${cy + r * 1.15} Q${cx + r * 0.7} ${cy + r * 1.25} ${cx + r * 0.85} ${cy + r * 0.1} Q${cx + r * 0.5} ${cy + r * 0.75} ${cx} ${cy + r * 0.62} Q${cx - r * 0.5} ${cy + r * 0.75} ${cx - r * 0.85} ${cy + r * 0.1} Z`}
          fill={C.hair}
        />
      ) : (
        <path
          d={`M${cx - r} ${cy - 1} C${cx - r} ${cy - r * 1.35} ${cx + r} ${cy - r * 1.35} ${cx + r} ${cy - 1} C${cx + r * 0.55} ${cy - r * 0.6} ${cx - r * 0.25} ${cy - r * 0.5} ${cx - r} ${cy - 1} Z`}
          fill={C.hair}
        />
      )}
      <circle cx={cx - r * 0.35} cy={cy + r * 0.05} r={r * 0.12} fill={C.eye} />
      <circle cx={cx + r * 0.35} cy={cy + r * 0.05} r={r * 0.12} fill={C.eye} />
      <circle cx={cx - r * 0.31} cy={cy} r={r * 0.045} fill="#fff" />
      <circle cx={cx + r * 0.39} cy={cy} r={r * 0.045} fill="#fff" />
      <circle cx={cx - r * 0.6} cy={cy + r * 0.38} r={r * 0.13} fill="#f39a8f" opacity="0.45" />
      <circle cx={cx + r * 0.6} cy={cy + r * 0.38} r={r * 0.13} fill="#f39a8f" opacity="0.45" />
      <path d={`M${cx - r * 0.25} ${cy + r * 0.42} Q${cx} ${cy + r * 0.62} ${cx + r * 0.25} ${cy + r * 0.42}`} fill="none" stroke="#8a3b2e" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function Limb({ d, color, w = 7 }: { d: string; color: string; w?: number }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
}

// 0 ลิงน้อย: นั่งตัวเล็ก หางม้วน
function Stage0({ g }: { g: G }) {
  return (
    <>
      <Ground />
      <Limb d="M74 98 C96 100 98 74 86 70 C80 68 77 76 83 78" color={C.fur} w={4} />
      <ellipse cx="45" cy="93" rx="5" ry="9" transform="rotate(20 45 93)" fill={C.fur} />
      <ellipse cx="75" cy="93" rx="5" ry="9" transform="rotate(-20 75 93)" fill={C.fur} />
      <ellipse cx="60" cy="91" rx="16" ry="17" fill={`url(#${g.fur})`} />
      <ellipse cx="60" cy="94" rx="10" ry="11" fill={C.face} />
      <ellipse cx="50" cy="107" rx="7" ry="4" fill={C.furDark} />
      <ellipse cx="70" cy="107" rx="7" ry="4" fill={C.furDark} />
      <MonkeyHead cx={60} cy={62} r={19} g={g} />
    </>
  )
}

// 1 ลิงช่างสงสัย: เอามือแตะคาง มีฟองคำถาม
function Stage1({ g }: { g: G }) {
  return (
    <>
      <Ground />
      <Limb d="M74 98 C98 100 100 72 88 66 C81 63 77 72 84 75" color={C.fur} w={4} />
      <ellipse cx="44" cy="92" rx="5" ry="10" transform="rotate(18 44 92)" fill={C.fur} />
      <ellipse cx="60" cy="89" rx="17" ry="18" fill={`url(#${g.fur})`} />
      <ellipse cx="60" cy="92" rx="10.5" ry="12" fill={C.face} />
      <ellipse cx="49" cy="107" rx="7.5" ry="4" fill={C.furDark} />
      <ellipse cx="71" cy="107" rx="7.5" ry="4" fill={C.furDark} />
      <g transform="rotate(-8 58 60)">
        <MonkeyHead cx={58} cy={59} r={19} g={g} />
      </g>
      <Limb d="M74 86 C80 80 74 74 66 74" color={C.fur} w={7} />
      <circle cx="66" cy="74" r="4" fill={C.face} />
      <circle cx="80" cy="44" r="2" fill="#fff" stroke={C.navy} strokeWidth="1.2" />
      <circle cx="85" cy="37" r="3" fill="#fff" stroke={C.navy} strokeWidth="1.2" />
      <circle cx="96" cy="24" r="11" fill="#fff" stroke={C.navy} strokeWidth="1.5" />
      <text x="96" y="30" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1f56d6">
        ?
      </text>
    </>
  )
}

// 2 วานรยืนสองขา: ตัวสูงขึ้น หลังงอเล็กน้อย แขนยาว
function Stage2({ g }: { g: G }) {
  return (
    <>
      <Ground />
      <Limb d="M70 88 C92 92 96 68 86 62 C80 59 76 67 82 70" color={C.fur} w={4} />
      <Limb d="M54 90 L51 106" color={C.fur} w={8} />
      <Limb d="M66 90 L69 106" color={C.fur} w={8} />
      <ellipse cx="49" cy="108" rx="7" ry="3.5" fill={C.furDark} />
      <ellipse cx="71" cy="108" rx="7" ry="3.5" fill={C.furDark} />
      <ellipse cx="60" cy="75" rx="15" ry="19" transform="rotate(6 60 75)" fill={`url(#${g.fur})`} />
      <ellipse cx="61" cy="78" rx="9" ry="12" transform="rotate(6 61 78)" fill={C.face} />
      <Limb d="M47 64 C40 76 40 88 44 97" color={C.fur} w={7} />
      <Limb d="M73 64 C80 76 80 88 76 97" color={C.fur} w={7} />
      <circle cx="44" cy="98" r="4" fill={C.face} />
      <circle cx="76" cy="98" r="4" fill={C.face} />
      <MonkeyHead cx={62} cy={45} r={16} g={g} />
    </>
  )
}

// 3 มนุษย์ถ้ำ: ผ้าลายเสือ ถือขวานหิน
function Stage3({ g }: { g: G }) {
  return (
    <>
      <Ground />
      <Limb d="M54 92 L52 107" color={C.skin} w={7} />
      <Limb d="M66 92 L68 107" color={C.skin} w={7} />
      <ellipse cx="50" cy="108" rx="6.5" ry="3.5" fill={C.skinShade} />
      <ellipse cx="70" cy="108" rx="6.5" ry="3.5" fill={C.skinShade} />
      <Limb d="M46 67 C39 77 40 86 44 91" color={C.skin} w={6} />
      <path d="M45 63 Q60 58 75 63 L80 92 Q60 98 40 92 Z" fill={C.tunic} />
      <path d="M45 63 L75 63 L72 69 L48 69 Z" fill="#000" opacity="0.08" />
      <g fill={C.spot}>
        <ellipse cx="52" cy="76" rx="2.6" ry="1.8" />
        <ellipse cx="66" cy="72" rx="2.2" ry="1.6" />
        <ellipse cx="60" cy="85" rx="2.6" ry="1.8" />
        <ellipse cx="71" cy="84" rx="2" ry="1.5" />
        <ellipse cx="48" cy="88" rx="2" ry="1.4" />
      </g>
      <Limb d="M88 30 L88 70" color={C.wood} w={4} />
      <path d="M79 25 L94 22 L99 33 L84 37 Z" fill={C.stone} stroke={C.stoneDark} strokeWidth="1.5" strokeLinejoin="round" />
      <Limb d="M74 67 C82 64 87 58 88 52" color={C.skin} w={6} />
      <circle cx="88" cy="51" r="4" fill={C.skin} />
      <HumanHead cx={60} cy={45} r={15} g={g} hair="messy" />
    </>
  )
}

function Gear({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x={cx - r * 0.22}
          y={cy - r * 1.28}
          width={r * 0.44}
          height={r * 0.5}
          rx="1"
          fill={C.gold}
          transform={`rotate(${i * 45} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={C.gold} stroke={C.goldDark} strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={r * 0.4} fill="#fff7dc" stroke={C.goldDark} strokeWidth="1.2" />
    </g>
  )
}

// 4 มนุษย์นักประดิษฐ์: เสื้อช่าง แว่นกันลมบนหน้าผาก ชูเฟือง
function Stage4({ g }: { g: G }) {
  return (
    <>
      <Ground />
      <Limb d="M54 90 L53 106" color={C.navy} w={8} />
      <Limb d="M66 90 L67 106" color={C.navy} w={8} />
      <ellipse cx="51" cy="108" rx="7" ry="3.5" fill="#1b1f33" />
      <ellipse cx="69" cy="108" rx="7" ry="3.5" fill="#1b1f33" />
      <Limb d="M46 67 C40 77 41 86 45 90" color={C.sky} w={7} />
      <circle cx="45" cy="91" r="3.8" fill={C.skin} />
      <rect x="44" y="61" width="32" height="32" rx="9" fill={C.sky} />
      <rect x="44" y="61" width="32" height="8" rx="4" fill="#fff" opacity="0.25" />
      <rect x="50" y="73" width="20" height="20" rx="3" fill={C.navy} />
      <Limb d="M51 74 L48 63" color={C.navy} w={2.5} />
      <Limb d="M69 74 L72 63" color={C.navy} w={2.5} />
      <circle cx="55" cy="80" r="1.4" fill={C.gold} />
      <circle cx="65" cy="80" r="1.4" fill={C.gold} />
      <Limb d="M74 66 C83 62 88 54 89 47" color={C.sky} w={7} />
      <circle cx="89" cy="45" r="4" fill={C.skin} />
      <Gear cx={92} cy={32} r={8} />
      <HumanHead cx={60} cy={45} r={15} g={g} hair="neat" />
      <rect x="45" y="35" width="30" height="3.5" rx="1.75" fill="#3a3f55" />
      <circle cx="54" cy="36.5" r="4.6" fill="#bfe6fb" stroke="#3a3f55" strokeWidth="1.8" />
      <circle cx="66" cy="36.5" r="4.6" fill="#bfe6fb" stroke="#3a3f55" strokeWidth="1.8" />
    </>
  )
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  return <path d={`M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`} fill={C.gold} />
}

// 5 มนุษย์นักเทคโนโลยี: ชุดนักเรียน เหรียญทอง ถือแท็บเล็ตที่จอเรืองแสง
function Stage5({ g }: { g: G }) {
  return (
    <>
      <Ground />
      <Sparkle x={24} y={34} s={5} />
      <Sparkle x={98} y={24} s={6} />
      <Sparkle x={102} y={60} s={3.5} />
      <Limb d="M54 96 L53 105" color={C.skin} w={6} />
      <Limb d="M66 96 L67 105" color={C.skin} w={6} />
      <Limb d="M53 104 L53 106" color="#fff" w={6} />
      <Limb d="M67 104 L67 106" color="#fff" w={6} />
      <ellipse cx="51" cy="108.5" rx="6.5" ry="3.2" fill="#1b1f33" />
      <ellipse cx="69" cy="108.5" rx="6.5" ry="3.2" fill="#1b1f33" />
      <rect x="46" y="86" width="28" height="12" rx="3" fill={C.navy} />
      <rect x="45" y="61" width="30" height="29" rx="8" fill="#fff" stroke={C.line} strokeWidth="1.2" />
      <path d="M53 61 L60 68 L67 61" fill="none" stroke={C.line} strokeWidth="1.5" />
      <path d="M55 62 L60 72 L65 62" fill="none" stroke={C.navy} strokeWidth="1.6" />
      <circle cx="60" cy="74" r="4.6" fill={C.gold} stroke={C.goldDark} strokeWidth="1.2" />
      <path d="M58.2 74 L59.5 75.4 L62 72.6" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <Limb d="M47 66 C43 74 44 81 50 85" color="#fff" w={7} />
      <Limb d="M73 66 C77 74 76 81 70 85" color="#fff" w={7} />
      <rect x="46" y="79" width="28" height="18" rx="3.5" fill={C.navy} />
      <rect x="48.5" y="81.5" width="23" height="13" rx="2" fill={`url(#${g.glow})`} />
      <path d="M52 91 L56 87 L60 89 L66 84" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="86" r="3.5" fill={C.skin} />
      <circle cx="71" cy="86" r="3.5" fill={C.skin} />
      <HumanHead cx={60} cy={45} r={15} g={g} hair="neat" />
    </>
  )
}

const STAGES = [Stage0, Stage1, Stage2, Stage3, Stage4, Stage5]

export function EvolutionArtM3({ stage, className = '', title }: { stage: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  const g: G = { fur: `${id}fur`, skin: `${id}skin`, glow: `${id}glow` }
  const Stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage))] ?? Stage0
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <radialGradient id={g.fur} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={C.furLight} />
          <stop offset="55%" stopColor={C.fur} />
          <stop offset="100%" stopColor={C.furDark} />
        </radialGradient>
        <radialGradient id={g.skin} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fbe2c8" />
          <stop offset="65%" stopColor={C.skin} />
          <stop offset="100%" stopColor={C.skinShade} />
        </radialGradient>
        <linearGradient id={g.glow} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#1f56d6" />
        </linearGradient>
      </defs>
      <Stage g={g} />
    </svg>
  )
}

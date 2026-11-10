import type { ReactNode } from 'react'

// ภาพวิวัฒนาการ 8 ขั้น (SVG ในโค้ด สไตล์เดียวกัน): เจ้าทุยน้อย → … → มนุษย์ฐานข้อมูล

const C = {
  hide: '#7b8aa3',
  hideDark: '#56647d',
  belly: '#a9b5c8',
  horn: '#f3e6c8',
  hornLine: '#cdb88f',
  nose: '#d5c3bb',
  eye: '#0f1f3d',
  skin: '#f2c9a0',
  skinShade: '#e0b088',
  hair: '#24253a',
  shirt: '#ffffff',
  line: '#22397a',
  shorts: '#22397a',
  gold: '#e7b62a',
  goldDark: '#a67a00',
  book: '#1f56d6',
  sky: '#1c8bdf',
}

function Horns({ y = 30, spread = 0 }: { y?: number; spread?: number }) {
  return (
    <>
      <path d={`M${44 - spread} ${y + 6} C${30 - spread} ${y + 2} ${26 - spread} ${y - 10} ${34 - spread} ${y - 14} C${33 - spread} ${y - 6} ${38 - spread} ${y} ${46 - spread} ${y}`} fill={C.horn} stroke={C.hornLine} strokeWidth="1.5" />
      <path d={`M${76 + spread} ${y + 6} C${90 + spread} ${y + 2} ${94 + spread} ${y - 10} ${86 + spread} ${y - 14} C${87 + spread} ${y - 6} ${82 + spread} ${y} ${74 + spread} ${y}`} fill={C.horn} stroke={C.hornLine} strokeWidth="1.5" />
    </>
  )
}

function BuffaloFace({ cy = 42, glasses = false }: { cy?: number; glasses?: boolean }) {
  return (
    <>
      <Horns y={cy - 10} />
      <ellipse cx="38" cy={cy - 4} rx="7" ry="4" fill={C.hideDark} transform={`rotate(-20 38 ${cy - 4})`} />
      <ellipse cx="82" cy={cy - 4} rx="7" ry="4" fill={C.hideDark} transform={`rotate(20 82 ${cy - 4})`} />
      <ellipse cx="60" cy={cy} rx="20" ry="18" fill={C.hide} />
      <ellipse cx="60" cy={cy + 9} rx="13" ry="8" fill={C.nose} />
      <circle cx="55" cy={cy + 9} r="1.8" fill={C.hideDark} />
      <circle cx="65" cy={cy + 9} r="1.8" fill={C.hideDark} />
      <circle cx="52" cy={cy - 3} r="2.6" fill={C.eye} />
      <circle cx="68" cy={cy - 3} r="2.6" fill={C.eye} />
      <circle cx="52.8" cy={cy - 3.8} r="0.9" fill="#fff" />
      <circle cx="68.8" cy={cy - 3.8} r="0.9" fill="#fff" />
      {glasses && (
        <g fill="none" stroke={C.line} strokeWidth="1.8">
          <circle cx="52" cy={cy - 3} r="6" />
          <circle cx="68" cy={cy - 3} r="6" />
          <path d={`M58 ${cy - 3}h4`} />
        </g>
      )}
    </>
  )
}

function Stage0() {
  // ควายเดินสี่ขา (มองข้าง)
  return (
    <>
      <ellipse cx="60" cy="102" rx="38" ry="5" fill="#0f1f3d" opacity=".08" />
      <path d="M95 70c8 2 10 10 6 16" stroke={C.hideDark} strokeWidth="3" fill="none" strokeLinecap="round" />
      {[44, 54, 78, 88].map((x) => (
        <rect key={x} x={x - 4} y="76" width="8" height="24" rx="3" fill={C.hideDark} />
      ))}
      <ellipse cx="68" cy="70" rx="30" ry="18" fill={C.hide} />
      <ellipse cx="66" cy="78" rx="18" ry="8" fill={C.belly} opacity=".6" />
      <path d="M30 46c-8-4-12-14-6-20 0 8 4 12 10 13" fill={C.horn} stroke={C.hornLine} strokeWidth="1.5" />
      <path d="M44 44c6-6 16-6 14-14-2 7-8 9-14 9" fill={C.horn} stroke={C.hornLine} strokeWidth="1.5" />
      <ellipse cx="38" cy="58" rx="16" ry="14" fill={C.hide} />
      <ellipse cx="28" cy="64" rx="9" ry="7" fill={C.nose} />
      <circle cx="25" cy="64" r="1.5" fill={C.hideDark} />
      <circle cx="40" cy="54" r="2.6" fill={C.eye} />
      <circle cx="40.8" cy="53.2" r="0.9" fill="#fff" />
    </>
  )
}

function Stage1() {
  // นั่ง + เครื่องหมายคำถามทอง
  return (
    <>
      <ellipse cx="60" cy="104" rx="30" ry="5" fill="#0f1f3d" opacity=".08" />
      <ellipse cx="60" cy="84" rx="26" ry="20" fill={C.hide} />
      <ellipse cx="60" cy="88" rx="15" ry="12" fill={C.belly} opacity=".7" />
      <ellipse cx="42" cy="100" rx="9" ry="5" fill={C.hideDark} />
      <ellipse cx="78" cy="100" rx="9" ry="5" fill={C.hideDark} />
      <BuffaloFace cy={50} />
      <g transform="translate(92 14)">
        <circle r="11" fill={C.gold} />
        <path d="M-3.5-3c0-4 7-4 7 0 0 3-3.5 3-3.5 6" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cy="7" r="1.6" fill="#fff" />
      </g>
    </>
  )
}

function Stage2() {
  // นั่งอ่านหนังสือ + แว่น
  return (
    <>
      <ellipse cx="60" cy="104" rx="30" ry="5" fill="#0f1f3d" opacity=".08" />
      <ellipse cx="60" cy="84" rx="26" ry="20" fill={C.hide} />
      <ellipse cx="42" cy="100" rx="9" ry="5" fill={C.hideDark} />
      <ellipse cx="78" cy="100" rx="9" ry="5" fill={C.hideDark} />
      <BuffaloFace cy={48} glasses />
      <path d="M40 80l20 4 20-4v18l-20 4-20-4z" fill={C.book} />
      <path d="M60 84v18" stroke="#fff" strokeWidth="1.5" />
      <path d="M45 86h10M45 90h10M65 86h10M65 90h10" stroke="#fff" strokeWidth="1.2" opacity=".8" />
      <ellipse cx="38" cy="88" rx="5" ry="6" fill={C.hideDark} />
      <ellipse cx="82" cy="88" rx="5" ry="6" fill={C.hideDark} />
    </>
  )
}

function StageNote() {
  // ทุยนักจดบันทึก: นั่งจดข้อมูลลงตารางบนคลิปบอร์ด ถือดินสอ
  return (
    <>
      <ellipse cx="60" cy="104" rx="30" ry="5" fill="#0f1f3d" opacity=".08" />
      <ellipse cx="60" cy="84" rx="26" ry="20" fill={C.hide} />
      <ellipse cx="42" cy="100" rx="9" ry="5" fill={C.hideDark} />
      <ellipse cx="78" cy="100" rx="9" ry="5" fill={C.hideDark} />
      <BuffaloFace cy={46} glasses />
      <rect x="40" y="72" width="34" height="28" rx="3" fill="#b07a45" />
      <rect x="43" y="76" width="28" height="22" rx="1.5" fill="#fff" />
      <rect x="51" y="70" width="12" height="5" rx="1.5" fill="#8d9cb6" />
      <path d="M43 82h28M43 88h28M43 93h28M52 76v22M62 76v22" stroke={C.book} strokeWidth="1" opacity=".75" />
      <rect x="43" y="76" width="28" height="6" fill={C.book} opacity=".25" />
      <ellipse cx="38" cy="88" rx="5" ry="6" fill={C.hideDark} />
      <g transform="rotate(-35 82 82)">
        <rect x="79" y="70" width="5" height="20" rx="1" fill={C.gold} stroke={C.goldDark} strokeWidth=".8" />
        <path d="M79 90h5l-2.5 5z" fill="#f3e6c8" />
      </g>
      <ellipse cx="80" cy="88" rx="5" ry="6" fill={C.hideDark} />
    </>
  )
}

function Shirt({ y = 62, h = 30 }: { y?: number; h?: number }) {
  return (
    <>
      <path d={`M40 ${y + 4}c4-4 10-4 20-4s16 0 20 4l4 ${h}H36z`} fill={C.shirt} stroke={C.line} strokeWidth="1.6" />
      <path d={`M52 ${y}l8 8 8-8`} fill="none" stroke={C.line} strokeWidth="1.6" />
      <rect x="66" y={y + 12} width="8" height="6" rx="1" fill="none" stroke={C.line} strokeWidth="1.2" />
    </>
  )
}

function Stage3() {
  // ยืนสองขา ใส่เสื้อนักเรียน ถือหนังสือ
  return (
    <>
      <ellipse cx="60" cy="108" rx="24" ry="4" fill="#0f1f3d" opacity=".08" />
      <rect x="47" y="90" width="10" height="16" rx="3" fill={C.hideDark} />
      <rect x="63" y="90" width="10" height="16" rx="3" fill={C.hideDark} />
      <rect x="42" y="86" width="36" height="10" rx="3" fill={C.shorts} />
      <Shirt y={56} h={30} />
      <rect x="30" y="62" width="9" height="22" rx="4" fill={C.hide} />
      <rect x="81" y="62" width="9" height="22" rx="4" fill={C.hide} />
      <rect x="84" y="70" width="14" height="18" rx="2" fill={C.book} />
      <BuffaloFace cy={36} glasses />
    </>
  )
}

function StageKey() {
  // ทุยถือกุญแจ: ยืนสองขา ชูกุญแจทอง (คีย์หลัก)
  return (
    <>
      <ellipse cx="60" cy="108" rx="24" ry="4" fill="#0f1f3d" opacity=".08" />
      <rect x="47" y="90" width="10" height="16" rx="3" fill={C.hideDark} />
      <rect x="63" y="90" width="10" height="16" rx="3" fill={C.hideDark} />
      <rect x="42" y="86" width="36" height="10" rx="3" fill={C.shorts} />
      <Shirt y={56} h={30} />
      <rect x="30" y="62" width="9" height="22" rx="4" fill={C.hide} />
      <path d="M81 66 C88 60 90 52 90 46" stroke={C.hide} strokeWidth="9" strokeLinecap="round" fill="none" />
      <g transform="translate(92 26) rotate(20)">
        <circle r="8" fill={C.gold} stroke={C.goldDark} strokeWidth="1.4" />
        <circle r="3.2" fill="#fff7dc" stroke={C.goldDark} strokeWidth="1" />
        <rect x="-2" y="7" width="4" height="18" rx="1" fill={C.gold} stroke={C.goldDark} strokeWidth="1" />
        <rect x="2" y="17" width="5" height="3" rx="1" fill={C.gold} stroke={C.goldDark} strokeWidth=".8" />
        <rect x="2" y="21" width="4" height="3" rx="1" fill={C.gold} stroke={C.goldDark} strokeWidth=".8" />
      </g>
      <text x="100" y="58" textAnchor="middle" fontSize="8" fontWeight="800" fill={C.goldDark}>
        PK
      </text>
      <BuffaloFace cy={36} glasses />
    </>
  )
}

function Stage4() {
  // ครึ่งทุยครึ่งคน: หน้าคน แต่ยังมีเขาเล็ก ๆ หูทุย ถือแท็บเล็ต
  return (
    <>
      <ellipse cx="60" cy="110" rx="24" ry="4" fill="#0f1f3d" opacity=".08" />
      <rect x="48" y="92" width="9" height="16" rx="3" fill={C.skin} />
      <rect x="63" y="92" width="9" height="16" rx="3" fill={C.skin} />
      <rect x="42" y="86" width="36" height="10" rx="3" fill={C.shorts} />
      <Shirt y={56} h={30} />
      <rect x="31" y="62" width="8" height="22" rx="4" fill={C.skin} />
      <rect x="81" y="62" width="8" height="22" rx="4" fill={C.skin} />
      <rect x="44" y="70" width="32" height="20" rx="3" fill={C.line} />
      <rect x="47" y="73" width="26" height="14" rx="1.5" fill={C.sky} />
      <path d="M50 77h20M50 80h20M50 83h20M56 74v12M64 74v12" stroke="#fff" strokeWidth=".9" opacity=".8" />
      <path d="M44 26c-4-2-6-8-2-11 0 4 2 6 5 7" fill={C.horn} stroke={C.hornLine} strokeWidth="1.2" />
      <path d="M76 26c4-2 6-8 2-11 0 4-2 6-5 7" fill={C.horn} stroke={C.hornLine} strokeWidth="1.2" />
      <ellipse cx="40" cy="38" rx="6" ry="3.5" fill={C.hide} transform="rotate(-20 40 38)" />
      <ellipse cx="80" cy="38" rx="6" ry="3.5" fill={C.hide} transform="rotate(20 80 38)" />
      <circle cx="60" cy="38" r="16" fill={C.skin} />
      <path d="M45 34c2-10 26-12 30 0-6-4-24-4-30 0z" fill={C.hair} />
      <g fill="none" stroke={C.line} strokeWidth="1.6">
        <circle cx="54" cy="39" r="5" />
        <circle cx="66" cy="39" r="5" />
        <path d="M59 39h2" />
      </g>
      <circle cx="54" cy="39" r="1.8" fill={C.eye} />
      <circle cx="66" cy="39" r="1.8" fill={C.eye} />
      <path d="M55 46q5 4 10 0" stroke={C.skinShade} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  )
}

function Stage5() {
  // มนุษย์ฐานข้อมูล: นักเรียน ม.5 แล็ปท็อป + เหรียญทอง
  return (
    <>
      <ellipse cx="60" cy="110" rx="26" ry="4" fill="#0f1f3d" opacity=".08" />
      <rect x="48" y="92" width="9" height="16" rx="3" fill={C.skin} />
      <rect x="63" y="92" width="9" height="16" rx="3" fill={C.skin} />
      <rect x="42" y="86" width="36" height="10" rx="3" fill={C.shorts} />
      <Shirt y={56} h={30} />
      <path d="M54 56l6 14 6-14" fill="none" stroke={C.gold} strokeWidth="2.4" />
      <circle cx="60" cy="72" r="5" fill={C.gold} stroke={C.goldDark} strokeWidth="1" />
      <path d="M58 72l1.5 1.5 3-3" stroke="#fff" strokeWidth="1.4" fill="none" />
      <rect x="31" y="62" width="8" height="22" rx="4" fill={C.skin} />
      <rect x="81" y="62" width="8" height="22" rx="4" fill={C.skin} />
      <path d="M38 80h44l6 10H32z" fill="#c3cfe1" stroke="#8d9cb6" strokeWidth="1" />
      <rect x="40" y="66" width="40" height="15" rx="2" fill={C.line} />
      <rect x="42.5" y="68" width="35" height="11" rx="1" fill={C.sky} />
      <g transform="translate(60 73.5)" fill="#fff">
        <ellipse cy="-3" rx="5" ry="1.6" />
        <path d="M-5-3v6c0 1 2.2 1.6 5 1.6s5-.6 5-1.6v-6c0 1-2.2 1.6-5 1.6s-5-.6-5-1.6z" opacity=".9" />
      </g>
      <circle cx="60" cy="38" r="16" fill={C.skin} />
      <path d="M44 36c0-14 32-16 32-1-4-6-12-8-18-6-6 2-10 4-14 7z" fill={C.hair} />
      <g fill="none" stroke={C.line} strokeWidth="1.6">
        <rect x="49" y="35" width="10" height="7" rx="3" />
        <rect x="61" y="35" width="10" height="7" rx="3" />
        <path d="M59 38h2" />
      </g>
      <circle cx="54" cy="38.5" r="1.8" fill={C.eye} />
      <circle cx="66" cy="38.5" r="1.8" fill={C.eye} />
      <path d="M54 46q6 5 12 0" stroke={C.skinShade} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <g transform="translate(96 22)" fill={C.gold}>
        <path d="M0-8l2.4 5 5.6.8-4 3.9 1 5.5L0 4.6l-5 2.6 1-5.5-4-3.9 5.6-.8z" />
      </g>
    </>
  )
}

// ---------- วิวัฒนาการย่อยช่วงเกรด 0 (10/20/30/40 คะแนน): ลูกควายค่อย ๆ โตและลุกขึ้น ----------
// ตัวลูกควายเดินสี่ขา (ใช้ร่วม) — tilt = ยกตัวด้านหน้าขึ้น (หมุนรอบขาหลัง) · step = ก้าวขาหน้า · earsUp = หูผึ่ง
function Calf({ tilt = 0, step = 0, earsUp = false, children }: { tilt?: number; step?: number; earsUp?: boolean; children?: ReactNode }) {
  return (
    <g transform={`rotate(${tilt} 88 100)`}>
      <path d="M95 70c8 2 10 10 6 16" stroke={C.hideDark} strokeWidth="3" fill="none" strokeLinecap="round" />
      {[78, 88].map((x) => (
        <rect key={x} x={x - 4} y="76" width="8" height="24" rx="3" fill={C.hideDark} />
      ))}
      <g transform={`rotate(${step} 54 78)`}>
        <rect x="50" y="76" width="8" height="24" rx="3" fill={C.hideDark} />
      </g>
      <g transform={`rotate(${-step * 0.6} 44 78)`}>
        <rect x="40" y="76" width="8" height="24" rx="3" fill={C.hideDark} />
      </g>
      <ellipse cx="68" cy="70" rx="30" ry="18" fill={C.hide} />
      <ellipse cx="62" cy="64" rx="18" ry="7" fill="#fff" opacity=".12" />
      <ellipse cx="66" cy="78" rx="18" ry="8" fill={C.belly} opacity=".6" />
      <path d="M30 46c-8-4-12-14-6-20 0 8 4 12 10 13" fill={C.horn} stroke={C.hornLine} strokeWidth="1.5" />
      <path d="M44 44c6-6 16-6 14-14-2 7-8 9-14 9" fill={C.horn} stroke={C.hornLine} strokeWidth="1.5" />
      {earsUp ? (
        <>
          <ellipse cx="26" cy="46" rx="4" ry="9" fill={C.hideDark} transform="rotate(-35 26 46)" />
          <ellipse cx="26" cy="46" rx="2" ry="5.5" fill="#e8b4b0" transform="rotate(-35 26 46)" />
          <ellipse cx="51" cy="47" rx="4" ry="9" fill={C.hideDark} transform="rotate(35 51 47)" />
          <ellipse cx="51" cy="47" rx="2" ry="5.5" fill="#e8b4b0" transform="rotate(35 51 47)" />
        </>
      ) : (
        <ellipse cx="50" cy="52" rx="7" ry="3.5" fill={C.hideDark} transform="rotate(25 50 52)" />
      )}
      <ellipse cx="38" cy="58" rx="16" ry="14" fill={C.hide} />
      <ellipse cx="34" cy="53" rx="8" ry="5" fill="#fff" opacity=".14" />
      <ellipse cx="28" cy="64" rx="9" ry="7" fill={C.nose} />
      <circle cx="25" cy="64" r="1.5" fill={C.hideDark} />
      <circle cx="40" cy="54" r="2.8" fill={C.eye} />
      <circle cx="41" cy="53" r="1.1" fill="#fff" />
      {children}
    </g>
  )
}

function Sparkle({ x, y, s = 1, fill = C.gold }: { x: number; y: number; s?: number; fill?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-6C1-1 1-1 6 0 1 1 1 1 0 6-1 1-1 1-6 0-1-1-1-1 0-6z" fill={fill} />
}

function StageWalk() {
  // ทุยน้อยหัดเดิน: ก้าวขาหน้า ฝุ่นฟุ้งด้านหลัง
  return (
    <>
      <ellipse cx="62" cy="102" rx="40" ry="5" fill="#0f1f3d" opacity=".1" />
      <g fill="#c7d0dd">
        <circle cx="104" cy="98" r="4" />
        <circle cx="111" cy="94" r="3" />
        <circle cx="113" cy="100" r="2.4" />
      </g>
      <path d="M100 80h10M103 86h8" stroke="#a9b5c8" strokeWidth="2" strokeLinecap="round" />
      <Calf step={-22} />
    </>
  )
}

function StageEars() {
  // ทุยน้อยหูผึ่ง: หูตั้งฟัง มีโน้ตเสียงลอยมา
  return (
    <>
      <ellipse cx="62" cy="102" rx="40" ry="5" fill="#0f1f3d" opacity=".1" />
      <Calf earsUp step={-8} />
      <g fill={C.sky}>
        <path d="M10 26v-12l9-3v12" stroke={C.sky} strokeWidth="1.8" fill="none" />
        <circle cx="8" cy="27" r="3" />
        <circle cx="17" cy="24" r="3" />
      </g>
      <path d="M8 40q-4 6 0 12M3 37q-6 9 0 18" stroke={C.sky} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".7" />
    </>
  )
}

function StagePencil() {
  // ทุยน้อยคาบดินสอ: คาบดินสอ ข้าง ๆ มีกระดาษจดข้อมูล
  return (
    <>
      <ellipse cx="62" cy="102" rx="40" ry="5" fill="#0f1f3d" opacity=".1" />
      <g transform="rotate(-8 104 92)">
        <rect x="94" y="80" width="20" height="22" rx="2" fill="#fff" stroke="#c3cfe1" />
        <path d="M97 86h14M97 91h14M97 96h10" stroke={C.book} strokeWidth="1.2" opacity=".7" />
      </g>
      <Calf earsUp step={-6}>
        <g transform="rotate(-12 22 68)">
          <rect x="4" y="66" width="26" height="5" rx="1" fill={C.gold} stroke={C.goldDark} strokeWidth=".8" />
          <path d="M4 66l-5 2.5 5 2.5z" fill="#f3e6c8" />
          <rect x="27" y="66" width="4" height="5" rx="1" fill="#f39a8f" />
        </g>
      </Calf>
    </>
  )
}

function StageRise() {
  // ทุยน้อยใกล้ผ่าน: ยกตัวด้านหน้าขึ้น เกือบนั่ง/ยืนได้ มีประกายรอบตัว
  return (
    <>
      <ellipse cx="66" cy="102" rx="34" ry="5" fill="#0f1f3d" opacity=".1" />
      <Calf earsUp tilt={18} step={-30} />
      <Sparkle x={18} y={24} s={1.2} />
      <Sparkle x={36} y={10} s={0.8} />
      <Sparkle x={102} y={34} s={0.9} fill={C.sky} />
      <path d="M96 18v-10M91 13l5-5 5 5" stroke={C.gold} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

// ลำดับภาพ = ลำดับขั้นทั้งหมด (EVO_STAGES): ขั้นแรก + ขั้นย่อย 4 ภาพ + ขั้นหลัก 7 ภาพ
const STAGES = [Stage0, StageWalk, StageEars, StagePencil, StageRise, Stage1, Stage2, StageNote, Stage3, StageKey, Stage4, Stage5]

export function EvolutionArt({ stage, className = 'size-24', title }: { stage: number; className?: string; title?: string }) {
  const Art = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage))] ?? Stage0
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Art />
    </svg>
  )
}

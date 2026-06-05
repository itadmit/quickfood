/**
 * Decorative pizza illustration - ported from prototypes/app.jsx (PizzaArt).
 * Used as a placeholder when no real image is uploaded.
 */

const PALETTES: Record<string, [string, string, string, string]> = {
  margherita: ["#e8c987", "#d44a2a", "#f0e3c8", "#5fa84a"],
  pepperoni: ["#e8c987", "#a8351a", "#f0e3c8", "#7a2010"],
  funghi: ["#e8c987", "#a87a48", "#f0e3c8", "#5a3a26"],
  olives: ["#e8c987", "#cc4b22", "#f0e3c8", "#1f2a1a"],
  bianca: ["#f4ddb0", "#fbf1d6", "#ffffff", "#5fa84a"],
  truffle: ["#e8c987", "#7d5638", "#efe1c1", "#2a1d12"],
  rucola: ["#e8c987", "#c44226", "#f0e3c8", "#3f7a2a"],
  diavola: ["#e8c987", "#b62a18", "#f0e3c8", "#c2421f"],
};

export function PizzaArt({
  size = 120,
  type = "margherita",
}: {
  size?: number;
  type?: string;
}) {
  const [crust, sauce, cheese, top] = PALETTES[type] ?? PALETTES.margherita;
  const cx = size / 2;
  const cy = size / 2;
  const rCrust = size * 0.46;
  const rSauce = size * 0.38;
  const rCheese = size * 0.34;

  // Deterministic toppings layout
  const toppings: Array<[number, number]> = [];
  const rng = mulberry32(type.length * 31 + 7);
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * rCheese * 0.7;
    toppings.push([cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist]);
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={rCrust} fill={crust} />
      <circle cx={cx} cy={cy} r={rSauce} fill={sauce} />
      <circle cx={cx} cy={cy} r={rCheese} fill={cheese} />
      {toppings.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={size * 0.04} fill={top} opacity={0.85} />
      ))}
    </svg>
  );
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Small line pictures for empty and notice states: the folder, a kettle,
 * a door ajar, an unlit lamp, a filed-away page and a phone. Clean SVG strokes,
 * decorative only. Green marks the one "yours" detail in each.
 */

const stroke = {
  fill: "none",
  stroke: "var(--ink)",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Folder({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={(size * 76) / 92} viewBox="0 0 120 96" {...stroke}>
      <g>
        <path d="M10 30h34l6-10h28l6 10h26v58H10z" />
        <path d="M10 44h100" />
        <path d="M26 30V14h56" stroke="var(--green)" />
      </g>
    </svg>
  );
}

export function Kettle({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" {...stroke}>
      <g>
        <path d="M30 96h60l-6-44H36z" />
        <path d="M36 52q24-14 48 0" />
        <path d="M84 62q18 0 18 14t-14 14" />
        <path d="M36 66 20 50" />
        <path d="M54 40q0-8 6-8t6 8" />
        <path
          className="steam"
          d="M50 26q-4-6 0-12M62 24q-4-6 0-12M74 26q-4-6 0-12"
          stroke="var(--green)"
        />
      </g>
    </svg>
  );
}

export function DoorAjar({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" {...stroke}>
      <g>
        <path d="M30 104V16h60v88" />
        <path d="M30 16l34 10v86L30 104" />
        <path d="M56 64h2" stroke="var(--green)" strokeWidth="3" />
        <path d="M14 104h92" />
      </g>
    </svg>
  );
}

export function Lamp({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" {...stroke}>
      <g>
        <path d="M40 46h40L72 18H48z" />
        <path d="M60 46v48" />
        <path d="M40 100h40" />
        <path d="M66 58v10" stroke="var(--green)" />
      </g>
    </svg>
  );
}

export function FiledPage({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" {...stroke}>
      <g>
        <path d="M14 46h34l6-10h28l6 10h18v60H14z" />
        <path d="M34 46V22h50v24" />
        <path d="M42 32h26M42 40h18" stroke="var(--green)" />
      </g>
    </svg>
  );
}

export function EmptyFolder({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" {...stroke}>
      <g>
        <path d="M12 40h34l6-10h28l6 10h22v62H12z" />
        <path d="M12 56h96" />
        <path d="M50 78h20" stroke="var(--green)" />
      </g>
    </svg>
  );
}

export function Phone({ size = 92 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" {...stroke}>
      <g>
        <path d="M22 70q0-40 38-40t38 40" />
        <path d="M22 70h20v-12H22zM78 70h20v-12H78z" />
        <path
          className="cord"
          d="M60 70v14q0 16 16 18t20 14"
          stroke="var(--green)"
          pathLength={1}
        />
      </g>
    </svg>
  );
}

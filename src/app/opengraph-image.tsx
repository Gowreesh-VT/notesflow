import { ImageResponse } from "next/og";
import { BRAND_COLOR, BRAND_PAPER, LOGO_DOT, LOGO_TICK } from "@/lib/brand";

export const alt = "Notesflow — a calmer way to get things done";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: BRAND_PAPER,
        color: "#161a22",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: BRAND_COLOR,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d={LOGO_TICK}
              stroke="#fff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={LOGO_DOT.r} fill="#fff" opacity="0.7" />
          </svg>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Notesflow</div>
      </div>
      <div
        style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 40, maxWidth: 900 }}
      >
        A calmer way to get things done.
      </div>
      <div style={{ fontSize: 34, color: "#4a5568", marginTop: 28 }}>
        Tasks and notes in one place. Offline. Syncs when you want it.
      </div>
    </div>,
    size,
  );
}

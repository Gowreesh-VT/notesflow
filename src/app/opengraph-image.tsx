import { ImageResponse } from "next/og";

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
        background: "#faf7f2",
        color: "#231e19",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "#c24a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Notesflow</div>
      </div>
      <div
        style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 40, maxWidth: 900 }}
      >
        A calmer way to get things done.
      </div>
      <div style={{ fontSize: 34, color: "#5f5446", marginTop: 28 }}>
        Tasks and notes in one place. Offline. Syncs when you want it.
      </div>
    </div>,
    size,
  );
}

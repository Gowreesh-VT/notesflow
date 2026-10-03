import { ImageResponse } from "next/og";
import { BRAND_COLOR, LOGO_DOT, LOGO_TICK } from "@/lib/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Browser tab icon, rendered at build time from the shared brand mark.
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_COLOR,
        borderRadius: 18,
      }}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
        <path
          d={LOGO_TICK}
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={LOGO_DOT.r} fill="#ffffff" opacity="0.7" />
      </svg>
    </div>,
    size,
  );
}

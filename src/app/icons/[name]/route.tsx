import { ImageResponse } from "next/og";
import { BRAND_COLOR, LOGO_DOT, LOGO_TICK } from "@/lib/brand";

// App icons are rendered at build time so no binary files live in the repository.
const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "icon-192": { size: 192, maskable: false },
  "icon-512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
  "apple-touch": { size: 180, maskable: true },
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { size, maskable } = ICONS[name];
  // Maskable icons keep the glyph inside the central safe zone and fill the whole square.
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_COLOR,
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
        <path
          d={LOGO_TICK}
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={LOGO_DOT.r} fill="#ffffff" opacity="0.7" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}

import { describe, expect, it } from "vitest";
import { fillNoise, type NoiseKind } from "./noise";

// A small deterministic generator so the shape of each noise can be compared.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Average absolute difference between neighbouring samples: high for bright noise, low for deep noise. */
function roughness(kind: NoiseKind) {
  const out = new Float32Array(20_000);
  fillNoise(kind, out, seeded(42));
  let sum = 0;
  for (let i = 1; i < out.length; i++) sum += Math.abs(out[i] - out[i - 1]);
  return { roughness: sum / out.length, max: Math.max(...out.map(Math.abs)) };
}

describe("noise", () => {
  it("stays within range and gets darker from white to pink to brown", () => {
    const white = roughness("white");
    const pink = roughness("pink");
    const brown = roughness("brown");
    for (const n of [white, pink, brown]) expect(n.max).toBeLessThanOrEqual(1);
    expect(white.roughness).toBeGreaterThan(pink.roughness);
    expect(pink.roughness).toBeGreaterThan(brown.roughness);
  });
});

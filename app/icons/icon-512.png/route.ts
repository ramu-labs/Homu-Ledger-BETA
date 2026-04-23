import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#1a1a1a",
          borderRadius: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 280,
        }}
      >
        🏠
      </div>
    ),
    { width: 512, height: 512 }
  );
}

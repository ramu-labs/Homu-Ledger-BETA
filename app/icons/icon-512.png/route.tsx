import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="420" height="420" viewBox="0 0 512 440">
          {/* Left figure body + arm (charcoal) */}
          <path
            d="M 256 192 C 240 197 224 206 210 220 C 190 236 166 254 152 282 C 134 314 126 354 128 394 L 168 394 C 164 356 170 318 186 288 C 198 264 218 248 238 232 C 249 223 256 214 256 206 Z"
            fill="#4a4745"
          />
          {/* Left figure head (charcoal) */}
          <circle cx="188" cy="126" r="66" fill="#4a4745" />

          {/* Right figure body + arm (beige) */}
          <path
            d="M 256 192 C 272 197 288 206 302 220 C 322 236 346 254 360 282 C 378 314 386 354 384 394 L 344 394 C 348 356 342 318 326 288 C 314 264 294 248 274 232 C 263 223 256 214 256 206 Z"
            fill="#c9a882"
          />
          {/* Right figure head (beige) */}
          <circle cx="324" cy="142" r="58" fill="#c9a882" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FamilyLedger",
    short_name: "FamilyLedger",
    description: "Shared expense tracker for couples & families",
    start_url: "/transactions",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f0eb",
    theme_color: "#1a1a1a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

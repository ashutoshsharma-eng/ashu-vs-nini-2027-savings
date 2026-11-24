import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Husband vs Wife · 2027 Savings",
    short_name: "HvW 2027",
    description: "Ashutosh vs Niharika — the 52-box savings challenge.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

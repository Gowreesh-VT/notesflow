import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notesflow",
    short_name: "Notesflow",
    description: "To-do lists and Markdown notes in one fast, private workspace.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafaf9",
    theme_color: "#4f46e5",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/?view=today", description: "Tasks due today" },
      { name: "Inbox", url: "/?view=inbox", description: "Your inbox" },
    ],
  };
}

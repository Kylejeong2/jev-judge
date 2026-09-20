import type { Metadata } from "next";
import gallery from "@/data/gallery.json";
import type { GalleryEntry } from "@/lib/gallery";
import { Gallery } from "@/components/Gallery";

export const metadata: Metadata = {
  title: "Gallery · Jev as a Judge",
  description: "How Jev rules on 100+ landmark cases, compared with the real outcomes.",
};

export default function GalleryPage() {
  const entries = gallery as GalleryEntry[];
  return <Gallery entries={entries} />;
}

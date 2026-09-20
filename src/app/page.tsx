import gallery from "@/data/gallery.json";
import type { GalleryEntry } from "@/lib/gallery";
import type { CaseInput } from "@/lib/types";
import { Courtroom } from "@/components/Courtroom";

const SAMPLE_IDS = [
  "hadley-v-baxendale",
  "palsgraf-v-lirr",
  "miranda-v-arizona",
  "carlill-v-carbolic",
  "brown-v-board",
  "donoghue-v-stevenson",
];

export default function SingleCasePage() {
  const entries = gallery as GalleryEntry[];
  const byId = new Map(entries.map((e) => [e.case.id, e.case]));
  const samples: CaseInput[] = SAMPLE_IDS.flatMap((id) => byId.get(id) ?? []);
  return <Courtroom samples={samples.length ? samples : entries.slice(0, 6).map((e) => e.case)} />;
}

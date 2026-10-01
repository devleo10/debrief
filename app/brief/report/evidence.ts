import type { ResearchResult } from "@/lib/research/types";

/** The dossier the agents argued over, as the report consumes it. */
export type EvidenceData = {
  brief: ResearchResult["brief"] | null;
  competitors: ResearchResult["competitors"];
  github: ResearchResult["github"];
  pricing: ResearchResult["pricing"] | null;
  funding: ResearchResult["funding"] | null;
  gaps: ResearchResult["gaps"] | null;
  distribution: ResearchResult["distribution"] | null;
  positioning: ResearchResult["positioning"] | null;
  launch: ResearchResult["launch"] | null;
};

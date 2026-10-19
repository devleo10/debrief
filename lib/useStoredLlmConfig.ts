"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readStoredLlmConfig,
  subscribeLlmKeyChanges,
} from "@/lib/llmKeyStorage";
import type { LlmConfig } from "@/lib/llmProviders";

/** Reactive view of the saved bring-your-own-key config. */
export function useStoredLlmConfig(): {
  config: LlmConfig | null;
  refresh: () => void;
} {
  const [config, setConfig] = useState<LlmConfig | null>(null);

  const refresh = useCallback(() => {
    setConfig(readStoredLlmConfig());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeLlmKeyChanges(refresh);
  }, [refresh]);

  return { config, refresh };
}

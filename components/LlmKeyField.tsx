"use client";

import { useEffect, useId, useState } from "react";
import { clearStoredLlmKey, writeStoredLlmConfig } from "@/lib/llmKeyStorage";
import { useStoredLlmConfig } from "@/lib/useStoredLlmConfig";
import {
  PROVIDERS,
  detectProviderFromKey,
  isProviderId,
  providerFor,
  type LlmConfig,
  type ProviderId,
} from "@/lib/llmProviders";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";

type LlmKeyFieldProps = {
  onActive?: (active: boolean) => void;
};

const PROVIDER_LIST = Object.values(PROVIDERS);

export default function LlmKeyField({ onActive }: LlmKeyFieldProps) {
  const keyId = useId();
  const providerId = useId();
  const modelId = useId();
  const [open, setOpen] = useState(false);
  const { config: saved } = useStoredLlmConfig();
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onActive?.(Boolean(saved));
  }, [saved, onActive]);

  useEffect(() => {
    const detected = detectProviderFromKey(key);
    if (detected) setProvider(detected);
  }, [key]);

  const test = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Paste an API key first.");
      return;
    }
    setTesting(true);
    setError("");
    try {
      const res = await fetch("/api/llm/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          llmKey: trimmed,
          llmProvider: provider,
          llmModel: model.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        provider?: unknown;
        model?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Couldn't verify that key (${res.status}).`);
      }
      if (!isProviderId(data.provider) || !data.model) {
        throw new Error("Verification returned an unexpected response.");
      }
      const config: LlmConfig = {
        provider: data.provider,
        model: data.model,
        apiKey: trimmed,
      };
      writeStoredLlmConfig(config);
      setOpen(false);
      setKey("");
      setModel("");
      setError("");
      onActive?.(true);
      toastSuccess(
        `Using your ${providerFor(config.provider).label} key · ${config.model}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't verify that key.";
      setError(message);
      toastError(message);
    } finally {
      setTesting(false);
    }
  };

  const remove = () => {
    clearStoredLlmKey();
    setOpen(false);
    setKey("");
    setModel("");
    setError("");
    onActive?.(false);
    toastInfo("Removed your API key.");
  };

  if (saved) {
    return (
      <div className="llm-key">
        <div className="llm-key-saved-row">
          <span className="llm-key-saved">
            Using your {providerFor(saved.provider).label} key
            {saved.model ? ` · ${saved.model}` : ""}
          </span>
          <button type="button" className="llm-key-text-btn" onClick={remove}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  if (open) {
    const def = providerFor(provider);
    return (
      <div className="llm-key">
        <div className="llm-key-editor">
          <label className="llm-key-label" htmlFor={keyId}>
            API key
          </label>
          <input
            id={keyId}
            type="password"
            name="llm-api-key"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={key}
            placeholder={def.keyHint}
            onChange={(e) => {
              setKey(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!testing) void test();
              }
            }}
          />

          <div className="llm-key-grid">
            <div>
              <label className="llm-key-label" htmlFor={providerId}>
                Provider
              </label>
              <select
                id={providerId}
                value={provider}
                onChange={(e) => {
                  if (isProviderId(e.target.value)) setProvider(e.target.value);
                }}
              >
                {PROVIDER_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="llm-key-label" htmlFor={modelId}>
                Model
              </label>
              <input
                id={modelId}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={model}
                placeholder={def.defaultModel}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="llm-key-error" role="alert">
              {error}
            </p>
          )}

          <div className="llm-key-actions">
            <button
              type="button"
              className="llm-key-save"
              onClick={() => void test()}
              disabled={testing}
            >
              {testing ? "Testing…" : "Save & test"}
            </button>
            <button
              type="button"
              className="llm-key-text-btn"
              onClick={() => {
                setOpen(false);
                setKey("");
                setModel("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>

          <p className="llm-key-note">
            Bring your own key from{" "}
            <a href={def.docsUrl} target="_blank" rel="noreferrer">
              {def.label}
            </a>
            . It runs the agents on your account and skips verdict credits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="llm-key">
      <button
        type="button"
        className="llm-key-link"
        onClick={() => setOpen(true)}
      >
        Have your own OpenAI or Gemini key?
      </button>
    </div>
  );
}

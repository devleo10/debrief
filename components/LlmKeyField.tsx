"use client";

import { useEffect, useId, useState } from "react";
import {
  clearStoredLlmKey,
  hasStoredLlmKey,
  writeStoredLlmKey,
} from "@/lib/llmKeyStorage";
import { readUserLlmKey } from "@/lib/userLlmKey";

type LlmKeyFieldProps = {
  onActive?: (active: boolean) => void;
};

export default function LlmKeyField({ onActive }: LlmKeyFieldProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const active = hasStoredLlmKey();
    setSaved(active);
    onActive?.(active);
  }, [onActive]);

  const save = () => {
    const { key, error: keyError } = readUserLlmKey(value);
    if (!key) {
      setError(keyError || "Enter an OpenAI key that starts with sk-.");
      return;
    }
    writeStoredLlmKey(key);
    setValue("");
    setError("");
    setSaved(true);
    setOpen(false);
    onActive?.(true);
  };

  const remove = () => {
    clearStoredLlmKey();
    setSaved(false);
    setValue("");
    setError("");
    setOpen(false);
    onActive?.(false);
  };

  return (
    <div className="llm-key">
      {saved ? (
        <div className="llm-key-saved-row">
          <p className="llm-key-saved">OpenAI key saved in this browser.</p>
          <button type="button" className="llm-key-text-btn" onClick={remove}>
            Remove
          </button>
        </div>
      ) : open ? (
        <div className="llm-key-editor">
          <label className="llm-key-label" htmlFor={inputId}>
            OpenAI API key
          </label>
          <div className="llm-key-row">
            <input
              id={inputId}
              type="password"
              name="openai-api-key"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={value}
              placeholder="sk-..."
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
            <button type="button" className="llm-key-save" onClick={save}>
              Save key
            </button>
          </div>
          {error && (
            <p className="llm-key-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="llm-key-text-btn"
            onClick={() => {
              setOpen(false);
              setValue("");
              setError("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="llm-key-toggle"
          onClick={() => setOpen(true)}
        >
          Use your OpenAI key
        </button>
      )}
      <p className="llm-key-note">
        {saved
          ? "This briefing runs on your key and skips a credit. Live search still uses Debrief, up to 24 runs a day on this network."
          : "Optional. A saved key runs the agents on your account and skips briefing credits."}
      </p>
    </div>
  );
}

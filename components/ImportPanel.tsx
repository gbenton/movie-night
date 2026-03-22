"use client";

import { useMemo, useState } from "react";
import { createMovieListFromText } from "../lib/parseTextImport.ts";
import { parseJsonImport } from "../lib/parseJsonImport.ts";
import type { MovieList } from "../lib/types.ts";

interface ImportPanelProps {
  onImport: (list: MovieList) => void;
}

const TEXT_PLACEHOLDER = `1. The Social Network (2010)\n2. Zodiac (2007)\n3. Michael Clayton (2007)`;
const JSON_PLACEHOLDER = `{"listName":"Rewatchables Core","items":[{"rank":1,"title":"The Social Network","year":2010}]}`;

export function ImportPanel({ onImport }: ImportPanelProps) {
  const [listName, setListName] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [error, setError] = useState<string>();

  const isJson = useMemo(() => rawInput.trim().startsWith("{"), [rawInput]);

  function handleImport() {
    try {
      const importedList = isJson
        ? parseJsonImport(rawInput)
        : createMovieListFromText(listName.trim() || "Imported list", rawInput);

      if (importedList.movies.length === 0) {
        setError("Paste at least one movie before importing.");
        return;
      }

      setError(undefined);
      setRawInput("");
      setListName("");
      onImport(importedList);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Import a list</h2>
        </div>
        <p className="section-copy">Paste plain text or canonical JSON. JSON auto-detects.</p>
      </div>
      {!isJson ? (
        <label className="stack-sm">
          <span className="field-label">List name</span>
          <input
            type="text"
            placeholder="Rewatchables Core"
            value={listName}
            onChange={(event) => setListName(event.target.value)}
          />
        </label>
      ) : null}
      <label className="stack-sm">
        <span className="field-label">Paste plain text or JSON</span>
        <textarea
          placeholder={`${TEXT_PLACEHOLDER}\n\nOr JSON:\n${JSON_PLACEHOLDER}`}
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
        />
      </label>
      {error ? <p className="error-text">{error}</p> : <p className="helper-text">{isJson ? "JSON mode" : "Plain text mode"}</p>}
      <button className="primary-button" type="button" onClick={handleImport}>
        Save list
      </button>
    </section>
  );
}

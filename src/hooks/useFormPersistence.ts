/*
 * Intent: Form state persistence to IDB kv store (2026-10-05)
 * Original requirement: P2 "set size once, remembered" + P1 prompt不丢失
 */

import { useState, useEffect } from 'react';
import { getKV, setKV } from '../lib/storageNew';

interface FormDraft {
  lastPrompt?: string;
  lastSize?: string;
  lastAdvancedJson?: string;
  lastBatchPrompts?: string;
}

const DEBOUNCE_MS = 500;

export function useFormPersistence() {
  const [draft, setDraft] = useState<FormDraft>({});
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    Promise.all([
      getKV('lastPrompt'),
      getKV('lastSize'),
      getKV('lastAdvancedJson'),
      getKV('lastBatchPrompts'),
    ]).then(([prompt, size, json, batchPrompts]) => {
      setDraft({
        lastPrompt: typeof prompt === 'string' ? prompt : undefined,
        lastSize: typeof size === 'string' ? size : undefined,
        lastAdvancedJson: typeof json === 'string' ? json : undefined,
        lastBatchPrompts: typeof batchPrompts === 'string' ? batchPrompts : undefined,
      });
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  // Debounced save
  useEffect(() => {
    if (!loaded) return;

    const timer = setTimeout(() => {
      if (draft.lastPrompt !== undefined) {
        setKV('lastPrompt', draft.lastPrompt).catch(console.error);
      }
      if (draft.lastSize !== undefined) {
        setKV('lastSize', draft.lastSize).catch(console.error);
      }
      if (draft.lastAdvancedJson !== undefined) {
        setKV('lastAdvancedJson', draft.lastAdvancedJson).catch(console.error);
      }
      if (draft.lastBatchPrompts !== undefined) {
        setKV('lastBatchPrompts', draft.lastBatchPrompts).catch(console.error);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, loaded]);

  return {
    draft,
    setPrompt: (value: string) => setDraft(d => ({ ...d, lastPrompt: value })),
    setSize: (value: string) => setDraft(d => ({ ...d, lastSize: value })),
    setAdvancedJson: (value: string) => setDraft(d => ({ ...d, lastAdvancedJson: value })),
    setBatchPrompts: (value: string) => setDraft(d => ({ ...d, lastBatchPrompts: value })),
    loaded,
  };
}

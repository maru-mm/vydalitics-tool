"use client";

import { useAppStore } from "@/lib/store";
import { useCallback } from "react";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 1
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status < 500) return res;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Request failed");
}

export function useApi() {
  const apiToken = useAppStore((s) => s.apiToken);
  const openaiApiKey = useAppStore((s) => s.openaiApiKey);

  const apiFetch = useCallback(
    async <T>(endpoint: string, options: FetchOptions = {}): Promise<T> => {
      const { params, ...fetchOpts } = options;
      let url = `/api/vidalytics${endpoint}`;
      if (params) {
        const qs = new URLSearchParams(params);
        url += `?${qs.toString()}`;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...fetchOpts.headers as Record<string, string>,
      };
      if (apiToken) {
        headers["x-api-token"] = apiToken;
      }
      if (openaiApiKey) {
        headers["x-openai-key"] = openaiApiKey;
      }

      const res = await fetchWithRetry(
        url,
        { ...fetchOpts, headers },
        1
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }

      return res.json();
    },
    [apiToken, openaiApiKey]
  );

  return { apiFetch, isConfigured: !!apiToken };
}

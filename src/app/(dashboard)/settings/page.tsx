"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  Gauge,
  Trash2,
  Mic,
} from "lucide-react";

export default function SettingsPage() {
  const { apiToken, setApiToken, openaiApiKey, setOpenaiApiKey } = useAppStore();
  const { apiFetch } = useApi();
  const [tokenInput, setTokenInput] = useState(apiToken || "");
  const [openaiInput, setOpenaiInput] = useState(openaiApiKey || "");
  const [showToken, setShowToken] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{
    plan: string;
    api_requests_used: number;
    api_requests_limit: number;
    email: string;
  } | null>(null);

  useEffect(() => {
    if (!apiToken) return;
    apiFetch<{
      plan: string;
      api_requests_used: number;
      api_requests_limit: number;
      email: string;
    }>("/account")
      .then(setAccountInfo)
      .catch(() => {});
  }, [apiToken, apiFetch]);

  const handleSave = () => {
    if (tokenInput.trim()) {
      setApiToken(tokenInput.trim());
      setTestResult(null);
    }
  };

  const handleTest = async () => {
    if (!tokenInput.trim()) return;
    setTesting(true);
    setTestResult(null);

    const tempToken = tokenInput.trim();
    try {
      const res = await fetch("/api/vidalytics/videos", {
        headers: {
          "x-api-token": tempToken,
          "Content-Type": "application/json",
        },
      });
      setTestResult(res.ok ? "success" : "error");
      if (res.ok) {
        setApiToken(tempToken);
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    setApiToken(null);
    setTokenInput("");
    setTestResult(null);
    setAccountInfo(null);
  };

  const handleSaveOpenai = () => {
    if (openaiInput.trim()) {
      setOpenaiApiKey(openaiInput.trim());
      setOpenaiSaved(true);
      setTimeout(() => setOpenaiSaved(false), 2000);
    }
  };

  const handleRemoveOpenai = () => {
    setOpenaiApiKey(null);
    setOpenaiInput("");
  };

  const usagePercent = accountInfo
    ? Math.round((accountInfo.api_requests_used / accountInfo.api_requests_limit) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground">
          Configura la connessione al tuo account Vidalytics
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">API Token</h2>
            <p className="text-sm text-muted-foreground">
              Genera il token da Account Settings → Global Settings in Vidalytics
            </p>
          </div>
          {apiToken && (
            <Badge variant="success" >
              Connesso
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Input
              id="api-token"
              label="Token API Vidalytics"
              type={showToken ? "text" : "password"}
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setTestResult(null);
              }}
              placeholder="vid_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-[38px] text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {testResult === "success" && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <Check className="h-4 w-4" />
              Connessione riuscita! Token salvato.
            </div>
          )}
          {testResult === "error" && (
            <div className="flex items-center gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="h-4 w-4" />
              Token non valido o errore di connessione. Riprova.
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleTest} disabled={!tokenInput.trim() || testing}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Testa Connessione
            </Button>
            <Button variant="secondary" onClick={handleSave} disabled={!tokenInput.trim()}>
              <Check className="h-4 w-4" />
              Salva
            </Button>
            {apiToken && (
              <Button variant="danger" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
                Rimuovi
              </Button>
            )}
          </div>
        </div>
      </Card>

      {accountInfo && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-accent/10 p-2.5">
              <Gauge className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold">Informazioni Account</h2>
              <p className="text-sm text-muted-foreground">
                Dettagli del tuo piano e utilizzo API
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Piano</p>
              <p className="mt-1 text-lg font-semibold capitalize">{accountInfo.plan}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="mt-1 text-lg font-semibold">{accountInfo.email}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Utilizzo API mensile</p>
              <p className="text-sm font-medium">
                {accountInfo.api_requests_used.toLocaleString()} / {accountInfo.api_requests_limit.toLocaleString()}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{usagePercent}% utilizzato</p>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-emerald-500/10 p-2.5">
            <Mic className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold">OpenAI API Key</h2>
            <p className="text-sm text-muted-foreground">
              Necessaria per la trascrizione automatica delle VSL con Whisper
            </p>
          </div>
          {openaiApiKey && (
            <Badge variant="success">
              Configurata
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Input
              id="openai-key"
              label="Chiave API OpenAI"
              type={showOpenai ? "text" : "password"}
              value={openaiInput}
              onChange={(e) => {
                setOpenaiInput(e.target.value);
                setOpenaiSaved(false);
              }}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={() => setShowOpenai(!showOpenai)}
              className="absolute right-3 top-[38px] text-muted-foreground hover:text-foreground"
            >
              {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {openaiSaved && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <Check className="h-4 w-4" />
              Chiave OpenAI salvata!
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSaveOpenai} disabled={!openaiInput.trim()}>
              <Check className="h-4 w-4" />
              Salva
            </Button>
            {openaiApiKey && (
              <Button variant="danger" onClick={handleRemoveOpenai}>
                <Trash2 className="h-4 w-4" />
                Rimuovi
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium mb-2">A cosa serve?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Quando una VSL non ha sottotitoli attivati su Vidalytics, il sistema
              scarica automaticamente l&apos;audio e usa <strong className="text-foreground">OpenAI Whisper</strong> per
              generare una trascrizione completa secondo per secondo.
              Questo permette l&apos;analisi AI anche su video senza caption.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Come ottenere il Token API</h2>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white font-semibold">1</span>
            Accedi a <a href="https://app.vidalytics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">app.vidalytics.com</a>
          </li>
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white font-semibold">2</span>
            Vai su Account Settings → Global Settings
          </li>
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white font-semibold">3</span>
            Crea un nuovo API Token e copialo qui
          </li>
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white font-semibold">4</span>
            Richiede piano <strong className="text-foreground">Premium</strong> o superiore
          </li>
        </ol>
      </Card>
    </div>
  );
}

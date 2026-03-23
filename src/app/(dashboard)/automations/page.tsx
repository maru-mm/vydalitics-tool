"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Zap,
  Settings,
  Play,
  Clock,
  BarChart3,
  Mail,
  Bell,
  Plus,
  ToggleLeft,
  ToggleRight,
  Webhook,
  Trash2,
  Loader2,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { Webhook as WebhookType } from "@/lib/vidalytics-api";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  icon: React.ReactNode;
}

const PRESET_AUTOMATIONS: Automation[] = [
  {
    id: "low-engagement",
    name: "Alert Basso Engagement",
    description:
      "Ricevi una notifica quando un video scende sotto il 30% di avg watch time",
    trigger: "avg_watch_time < 30%",
    action: "Invia notifica email",
    enabled: false,
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    id: "high-conversion",
    name: "Celebra Alta Conversione",
    description:
      "Segnala quando un video supera il 5% di conversion rate",
    trigger: "conversion_rate > 5%",
    action: "Log + notifica",
    enabled: false,
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: "daily-report",
    name: "Report Giornaliero",
    description:
      "Ogni giorno alle 9:00 genera un riepilogo delle metriche principali",
    trigger: "Cron: ogni giorno 9:00",
    action: "Genera report email",
    enabled: false,
    icon: <Mail className="h-5 w-5" />,
  },
  {
    id: "new-video-alert",
    name: "Nuovo Video Rilevato",
    description: "Notifica quando viene aggiunto un nuovo video all'account",
    trigger: "Nuovo video creato",
    action: "Webhook + notifica",
    enabled: false,
    icon: <Play className="h-5 w-5" />,
  },
  {
    id: "watch-milestone",
    name: "Milestone Visualizzazioni",
    description:
      "Avvisa quando un video raggiunge 1K, 5K, 10K play",
    trigger: "plays = 1K / 5K / 10K",
    action: "Invia notifica",
    enabled: false,
    icon: <Bell className="h-5 w-5" />,
  },
  {
    id: "stale-video",
    name: "Video Inattivo",
    description:
      "Segnala video che non ricevono play da più di 7 giorni",
    trigger: "0 plays in 7 giorni",
    action: "Notifica + suggerimento",
    enabled: false,
    icon: <Clock className="h-5 w-5" />,
  },
];

const WEBHOOK_EVENTS = [
  { id: "play", label: "Play Video", description: "Quando un viewer avvia la riproduzione" },
  { id: "complete", label: "Completamento", description: "Quando un viewer completa il video" },
  { id: "conversion", label: "Conversione", description: "Quando un viewer converte" },
  { id: "cta_click", label: "CTA Click", description: "Quando un viewer clicca il CTA" },
  { id: "opt_in", label: "Opt-in", description: "Quando un viewer compila il play gate" },
  { id: "milestone_25", label: "25% Visto", description: "Quando il viewer raggiunge il 25%" },
  { id: "milestone_50", label: "50% Visto", description: "Quando il viewer raggiunge il 50%" },
  { id: "milestone_75", label: "75% Visto", description: "Quando il viewer raggiunge il 75%" },
];

export default function AutomationsPage() {
  const apiToken = useAppStore((s) => s.apiToken);
  const { apiFetch } = useApi();
  const [automations, setAutomations] = useState(PRESET_AUTOMATIONS);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingWebhooks(true);
    apiFetch<WebhookType[]>("/webhooks")
      .then(setWebhooks)
      .catch(() => {})
      .finally(() => setLoadingWebhooks(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  const toggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const toggleEvent = (eventId: string) => {
    setWebhookEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
    );
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim() || webhookEvents.length === 0) return;
    setCreatingWebhook(true);
    try {
      const webhook = await apiFetch<WebhookType>("/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: webhookUrl.trim(), events: webhookEvents }),
      });
      setWebhooks((prev) => [...prev, webhook]);
      setWebhookUrl("");
      setWebhookEvents([]);
      setShowWebhookForm(false);
    } catch {
      // handled
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    setDeletingWebhookId(id);
    try {
      await apiFetch(`/webhooks/${id}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch {
      // handled
    } finally {
      setDeletingWebhookId(null);
    }
  };

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automazioni</h1>
          <p className="text-muted-foreground">
            {enabledCount} automazioni attive su {automations.length}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nuova Automazione
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {automations.map((automation) => (
          <Card key={automation.id} className="animate-fade-in flex flex-col">
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                {automation.icon}
              </div>
              <button onClick={() => toggleAutomation(automation.id)}>
                {automation.enabled ? (
                  <ToggleRight className="h-7 w-7 text-success" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                )}
              </button>
            </div>
            <h3 className="mt-3 font-semibold">{automation.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {automation.description}
            </p>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Badge variant="info">Trigger</Badge>
                <span className="text-xs text-muted-foreground">
                  {automation.trigger}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success">Azione</Badge>
                <span className="text-xs text-muted-foreground">
                  {automation.action}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Webhook Management Section */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-accent/10 p-3">
              <Webhook className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Webhook</h3>
              <p className="text-sm text-muted-foreground">
                Invia dati a servizi esterni (Zapier, Make, n8n, CRM) per ogni evento video
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowWebhookForm(!showWebhookForm)}
          >
            <Plus className="h-4 w-4" />
            Aggiungi Webhook
          </Button>
        </div>

        {showWebhookForm && (
          <div className="mb-6 space-y-4 rounded-lg border border-border bg-secondary/30 p-4 animate-fade-in">
            <Input
              label="URL Endpoint"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
            />
            <div>
              <label className="text-sm font-medium text-foreground">Eventi</label>
              <p className="mb-2 text-xs text-muted-foreground">
                Seleziona gli eventi che attiveranno il webhook
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {WEBHOOK_EVENTS.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition-all ${
                      webhookEvents.includes(event.id)
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {webhookEvents.includes(event.id) ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-sm border border-border" />
                      )}
                      <span className="font-medium">{event.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowWebhookForm(false);
                  setWebhookUrl("");
                  setWebhookEvents([]);
                }}
              >
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={handleCreateWebhook}
                disabled={!webhookUrl.trim() || webhookEvents.length === 0 || creatingWebhook}
              >
                {creatingWebhook ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Crea Webhook
              </Button>
            </div>
          </div>
        )}

        {loadingWebhooks ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-secondary/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium font-mono">{wh.url}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {wh.events.map((ev) => (
                      <Badge key={ev} variant="info">{ev}</Badge>
                    ))}
                  </div>
                </div>
                <Badge variant={wh.active ? "success" : "default"}>
                  {wh.active ? "Attivo" : "Inattivo"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(wh.created_at).toLocaleDateString("it-IT")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteWebhook(wh.id)}
                  disabled={deletingWebhookId === wh.id}
                >
                  {deletingWebhookId === wh.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-danger" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nessun webhook configurato. Aggiungi un webhook per sincronizzare eventi video con i tuoi strumenti.
          </div>
        )}
      </Card>
    </div>
  );
}

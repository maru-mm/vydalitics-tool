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
    name: "Low Engagement Alert",
    description:
      "Get notified when a video drops below 30% avg watch time",
    trigger: "avg_watch_time < 30%",
    action: "Send email notification",
    enabled: false,
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    id: "high-conversion",
    name: "Celebrate High Conversion",
    description:
      "Flag when a video exceeds 5% conversion rate",
    trigger: "conversion_rate > 5%",
    action: "Log + notification",
    enabled: false,
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: "daily-report",
    name: "Daily Report",
    description:
      "Every day at 9:00 AM generate a summary of key metrics",
    trigger: "Cron: daily 9:00 AM",
    action: "Generate email report",
    enabled: false,
    icon: <Mail className="h-5 w-5" />,
  },
  {
    id: "new-video-alert",
    name: "New Video Detected",
    description: "Get notified when a new video is added to the account",
    trigger: "New video created",
    action: "Webhook + notification",
    enabled: false,
    icon: <Play className="h-5 w-5" />,
  },
  {
    id: "watch-milestone",
    name: "Views Milestone",
    description:
      "Alert when a video reaches 1K, 5K, 10K plays",
    trigger: "plays = 1K / 5K / 10K",
    action: "Send notification",
    enabled: false,
    icon: <Bell className="h-5 w-5" />,
  },
  {
    id: "stale-video",
    name: "Inactive Video",
    description:
      "Flag videos with no plays in over 7 days",
    trigger: "0 plays in 7 days",
    action: "Notification + suggestion",
    enabled: false,
    icon: <Clock className="h-5 w-5" />,
  },
];

const WEBHOOK_EVENTS = [
  { id: "play", label: "Video Play", description: "When a viewer starts playback" },
  { id: "complete", label: "Completion", description: "When a viewer completes the video" },
  { id: "conversion", label: "Conversion", description: "When a viewer converts" },
  { id: "cta_click", label: "CTA Click", description: "When a viewer clicks the CTA" },
  { id: "opt_in", label: "Opt-in", description: "When a viewer submits the play gate" },
  { id: "milestone_25", label: "25% Watched", description: "When the viewer reaches 25%" },
  { id: "milestone_50", label: "50% Watched", description: "When the viewer reaches 50%" },
  { id: "milestone_75", label: "75% Watched", description: "When the viewer reaches 75%" },
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
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-muted-foreground">
            {enabledCount} active automation{enabledCount !== 1 ? "s" : ""} of {automations.length}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          New Automation
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
                <Badge variant="success">Action</Badge>
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
              <h3 className="font-semibold">Webhooks</h3>
              <p className="text-sm text-muted-foreground">
                Send data to external services (Zapier, Make, n8n, CRM) for each video event
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowWebhookForm(!showWebhookForm)}
          >
            <Plus className="h-4 w-4" />
            Add Webhook
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
              <label className="text-sm font-medium text-foreground">Events</label>
              <p className="mb-2 text-xs text-muted-foreground">
                Select the events that will trigger the webhook
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
                Cancel
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
                Create Webhook
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
                  {wh.active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(wh.created_at).toLocaleDateString("en-US")}
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
            No webhooks configured. Add a webhook to sync video events with your tools.
          </div>
        )}
      </Card>
    </div>
  );
}

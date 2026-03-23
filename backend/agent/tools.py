"""
Vidalytics API tools for the LangChain agent.
Each tool calls the Vidalytics Public API directly and returns structured data
that Claude can analyze and reason about.

API base: https://api.vidalytics.com/public/v1
Auth header: X-API-Key
"""

import json
from typing import Optional
from datetime import datetime, timedelta

import httpx
from langchain_core.tools import tool

VIDALYTICS_BASE = "https://api.vidalytics.com/public/v1"

_current_token: str = ""


def set_vidalytics_token(token: str):
    global _current_token
    _current_token = token


def _headers() -> dict:
    return {
        "X-API-Key": _current_token,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def _get(endpoint: str, params: dict | None = None) -> dict | list:
    retries = 2
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    f"{VIDALYTICS_BASE}{endpoint}",
                    headers=_headers(),
                    params=params,
                )
                if resp.status_code == 429 and attempt < retries:
                    import asyncio
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                if resp.status_code >= 500 and attempt < retries:
                    import asyncio
                    await asyncio.sleep(1 * (attempt + 1))
                    continue
                resp.raise_for_status()
                return resp.json()
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            if attempt >= retries:
                raise
            import asyncio
            await asyncio.sleep(1 * (attempt + 1))
    raise Exception("Max retries exceeded")


def _unwrap_data(response: dict | list) -> list | dict:
    """Unwrap Vidalytics { status, content: { data } } envelope."""
    if isinstance(response, list):
        return response
    if isinstance(response, dict):
        content = response.get("content")
        if isinstance(content, dict):
            data = content.get("data")
            if data is not None:
                return data
            return content
        return response
    return response


def _unwrap_content(response: dict) -> dict:
    """Unwrap { status, content: { ... } } — return content directly."""
    if isinstance(response, dict) and "content" in response:
        return response["content"]
    return response


# ── Vidalytics Data Tools ────────────────────────────────────────────


@tool
async def get_all_videos(folder_id: Optional[str] = None) -> str:
    """Retrieve all videos from the Vidalytics account.
    Optionally filter by folder_id.
    Returns video names, IDs, status, views, and creation date.
    Use this tool when the user asks about their videos, wants a list,
    or when you need video IDs for further analysis."""
    params = {}
    if folder_id:
        params["folderId"] = folder_id
    raw = await _get("/video", params)
    videos = _unwrap_data(raw)
    if not videos or not isinstance(videos, list):
        return "Nessun video trovato nell'account."
    summary = []
    for v in videos:
        title = v.get("title", "Senza titolo")
        vid = v.get("id", "?")
        status = v.get("status", "?")
        views = v.get("views", 0)
        created = v.get("date_created", "N/A")[:10]
        folder = v.get("folder_id", "nessuna")
        summary.append(
            f"- **{title}** (ID: `{vid}`)\n"
            f"  Stato: {status} | Visualizzazioni: {views} | "
            f"Cartella: {folder} | Creato: {created}"
        )
    return f"**{len(videos)} video trovati:**\n\n" + "\n".join(summary)


@tool
async def get_all_videos_with_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> str:
    """Retrieve ALL videos with their full performance stats in a single call.
    This is the PREFERRED tool when you need to rank, compare, or find top/bottom
    performers across the entire account (e.g. "top 3 by conversions",
    "which video has the best play rate", "overall performance summary").
    Returns a ranked table with all key metrics for every video.
    Dates in YYYY-MM-DD format. Default: last 30 days."""
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    raw = await _get("/video")
    videos = _unwrap_data(raw)
    if not videos or not isinstance(videos, list):
        return "Nessun video trovato nell'account."

    import asyncio

    async def fetch_stats(video: dict) -> dict:
        vid = video.get("id", "")
        title = video.get("title", "Senza titolo")
        try:
            raw_stats = await _get(
                f"/stats/video/{vid}",
                {"dateFrom": date_from, "dateTo": date_to},
            )
            stats = _unwrap_content(raw_stats)
            return {
                "id": vid,
                "title": title,
                "views": video.get("views", 0),
                "status": video.get("status", "?"),
                "plays": stats.get("plays", 0),
                "playsUnique": stats.get("playsUnique", 0),
                "playRate": stats.get("playRate", 0),
                "unmuteRate": stats.get("unmuteRate", 0),
                "impressions": stats.get("impressions", 0),
                "conversions": stats.get("conversions", 0),
                "conversionRate": stats.get("conversionRate", 0),
                "avgPercentWatched": stats.get("avgPercentWatched", 0),
                "avgSecondsWatched": stats.get("avgSecondsWatched", 0),
            }
        except Exception:
            return {
                "id": vid, "title": title, "views": video.get("views", 0),
                "status": video.get("status", "?"),
                "plays": 0, "playsUnique": 0, "playRate": 0, "unmuteRate": 0,
                "impressions": 0, "conversions": 0, "conversionRate": 0,
                "avgPercentWatched": 0, "avgSecondsWatched": 0,
            }

    batch_size = 5
    all_stats = []
    for i in range(0, len(videos), batch_size):
        batch = videos[i : i + batch_size]
        results = await asyncio.gather(*[fetch_stats(v) for v in batch])
        all_stats.extend(results)

    all_stats.sort(key=lambda s: (s["conversions"], s["plays"]), reverse=True)

    header = (
        "| # | Video | Play | Play Unici | Play Rate | Unmute | "
        "Impressioni | Conv. | Conv. Rate | Avg % Guardato |\n"
        "|---|---|---|---|---|---|---|---|---|---|"
    )
    rows = []
    for i, s in enumerate(all_stats, 1):
        rows.append(
            f"| {i} | {s['title'][:30]} | {s['plays']:,.0f} | "
            f"{s['playsUnique']:,.0f} | {s['playRate']:.1f}% | "
            f"{s['unmuteRate']:.1f}% | {s['impressions']:,.0f} | "
            f"{s['conversions']:,.0f} | {s['conversionRate']:.1f}% | "
            f"{s['avgPercentWatched']:.1f}% |"
        )

    total_plays = sum(s["plays"] for s in all_stats)
    total_conv = sum(s["conversions"] for s in all_stats)
    total_impr = sum(s["impressions"] for s in all_stats)

    summary = (
        f"**Panoramica account** ({date_from} → {date_to}):\n"
        f"- **{len(all_stats)} video** totali\n"
        f"- **{total_plays:,.0f}** play totali | **{total_impr:,.0f}** impressioni | "
        f"**{total_conv:,.0f}** conversioni\n\n"
    )

    return summary + header + "\n" + "\n".join(rows)


@tool
async def get_video_stats(
    video_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> str:
    """Get total performance statistics for a specific video.
    Dates in YYYY-MM-DD format. Returns plays, unique plays, play rate,
    unmute rate, impressions, conversions, etc.
    Use this when the user asks about a specific video's performance."""
    params = {}
    if date_from:
        params["dateFrom"] = date_from
    else:
        params["dateFrom"] = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if date_to:
        params["dateTo"] = date_to
    else:
        params["dateTo"] = datetime.now().strftime("%Y-%m-%d")
    raw = await _get(f"/stats/video/{video_id}", params)
    stats = _unwrap_content(raw)

    plays = stats.get("plays", 0)
    plays_unique = stats.get("playsUnique", 0)
    play_rate = stats.get("playRate", 0)
    unmute = stats.get("unmuteRate", 0)
    impressions = stats.get("impressions", 0)
    conversions = stats.get("conversions", 0)

    return (
        f"**Statistiche video** (ID: `{video_id}`):\n\n"
        f"| Metrica | Valore |\n|---|---|\n"
        f"| Play Totali | {plays:,.0f} |\n"
        f"| Play Unici | {plays_unique:,.0f} |\n"
        f"| Play Rate | {play_rate:,.1f}% |\n"
        f"| Unmute Rate | {unmute:,.1f}% |\n"
        f"| Impressioni | {impressions:,.0f} |\n"
        f"| Conversioni | {conversions:,.0f} |"
    )


@tool
async def get_video_timeline(
    video_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    metrics: str = "plays,impressions,conversions",
) -> str:
    """Get time-series performance data for one or more videos.
    Dates in YYYY-MM-DD format. Default: last 30 days.
    Metrics can be: plays, impressions, conversions, playsUnique, etc.
    Use this for trend analysis, identifying performance patterns over time."""
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    params = {
        "videoGuids": video_id,
        "metrics": metrics,
        "dateFrom": date_from,
        "dateTo": date_to,
        "segment": "segment.all",
    }
    raw = await _get("/stats/videos/timeline", params)
    data = _unwrap_data(raw)

    if not data or not isinstance(data, list):
        return f"Nessun dato timeline per il video {video_id} nel periodo selezionato."

    # The timeline is nested: each segment has date entries
    # For segment.all, there's one entry
    segment_data = data[0] if data else {}
    entries = segment_data.get("data", []) if isinstance(segment_data, dict) else []

    if not entries:
        return f"Nessun dato timeline per il video {video_id}."

    rows = []
    for entry in entries:
        date_str = entry.get("date", "?")[:10]
        video_metrics = entry.get("data", [{}])
        m = video_metrics[0].get("metrics", {}) if video_metrics else {}
        rows.append(
            f"| {date_str} | {m.get('plays', 0):,.0f} | {m.get('impressions', 0):,.0f} | "
            f"{m.get('conversions', 0):,.0f} |"
        )

    header = "| Data | Play | Impressioni | Conv. |\n|---|---|---|---|"
    return (
        f"**Timeline video** (ID: `{video_id}`, {date_from} → {date_to}):\n\n"
        f"{header}\n" + "\n".join(rows)
    )


@tool
async def get_drop_off(
    video_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> str:
    """Get viewer drop-off statistics for a video.
    Shows at which seconds viewers stop watching.
    Use this to analyze where viewers lose interest in the video content."""
    params = {}
    if date_from:
        params["dateFrom"] = date_from
    else:
        params["dateFrom"] = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if date_to:
        params["dateTo"] = date_to
    else:
        params["dateTo"] = datetime.now().strftime("%Y-%m-%d")

    raw = await _get(f"/stats/video/{video_id}/drop-off", params)
    content = _unwrap_content(raw)
    all_data = content.get("all", {})
    watches = all_data.get("watches", {})

    if not watches:
        return f"Nessun dato di drop-off per il video {video_id}."

    sorted_seconds = sorted(watches.items(), key=lambda x: int(x[0]))
    max_viewers = max(int(v) for v in watches.values()) if watches else 1

    rows = []
    for sec, count in sorted_seconds:
        pct = (count / max_viewers) * 100 if max_viewers > 0 else 0
        mins = int(int(sec) // 60)
        secs = int(int(sec) % 60)
        rows.append(f"| {mins}:{secs:02d} | {count:,} | {pct:.1f}% |")

    header = "| Tempo | Viewer | % Ritenzione |\n|---|---|---|"
    return (
        f"**Analisi Drop-off** (video `{video_id}`):\n\n"
        f"Viewer iniziali: **{max_viewers:,}**\n\n"
        f"{header}\n" + "\n".join(rows[:30])
    )


@tool
async def get_live_metrics(video_id: str) -> str:
    """Get how many viewers are currently watching a specific video (live metrics).
    Returns the number of concurrent viewers with ~1 minute delay.
    Use this when the user asks who is watching right now."""
    raw = await _get(f"/stats/video/{video_id}/live-metrics")
    content = _unwrap_content(raw)
    watching = content.get("watching", 0)
    return f"**Live Metrics** (video `{video_id}`): **{watching}** spettatori attivi in questo momento."


@tool
async def get_api_usage() -> str:
    """Get the current API usage limits and remaining quota.
    Use this to check how many API requests have been used this month."""
    raw = await _get("/stats/usage")
    content = _unwrap_content(raw)
    monthly = content.get("monthly_limit", 0)
    used = content.get("current_usage", 0)
    remaining = content.get("remaining", 0)
    pct = (used / monthly * 100) if monthly > 0 else 0
    return (
        f"**Utilizzo API:**\n\n"
        f"| Metrica | Valore |\n|---|---|\n"
        f"| Limite mensile | {monthly:,} |\n"
        f"| Utilizzate | {used:,} |\n"
        f"| Rimanenti | {remaining:,} |\n"
        f"| % Utilizzato | {pct:.1f}% |"
    )


@tool
async def compare_videos(video_ids: list[str]) -> str:
    """Compare performance metrics across 2 or more videos side by side.
    Provide a list of video IDs. Returns a comparison table with all key metrics.
    Use this when the user wants to compare videos or find the best performer."""
    if len(video_ids) < 2:
        return "Servono almeno 2 video ID per un confronto."
    if len(video_ids) > 10:
        video_ids = video_ids[:10]

    # Get video names
    raw_videos = await _get("/video")
    videos = _unwrap_data(raw_videos)
    name_map = {v["id"]: v.get("title", v["id"][:12]) for v in videos} if isinstance(videos, list) else {}

    stats_list = []
    for vid in video_ids:
        try:
            raw = await _get(f"/stats/video/{vid}")
            s = _unwrap_content(raw)
            s["_id"] = vid
            stats_list.append(s)
        except Exception:
            stats_list.append({"_id": vid})

    header = "| Metrica | " + " | ".join(name_map.get(vid, vid[:12]) for vid in video_ids) + " |"
    sep = "|---|" + "|".join("---" for _ in video_ids) + "|"

    metrics = [
        ("Play", "plays", lambda v: f"{v:,.0f}"),
        ("Play Unici", "playsUnique", lambda v: f"{v:,.0f}"),
        ("Play Rate", "playRate", lambda v: f"{v:.1f}%"),
        ("Unmute Rate", "unmuteRate", lambda v: f"{v:.1f}%"),
        ("Impressioni", "impressions", lambda v: f"{v:,.0f}"),
        ("Conversioni", "conversions", lambda v: f"{v:,.0f}"),
    ]

    stat_map = {s["_id"]: s for s in stats_list}

    rows = []
    for label, key, fmt in metrics:
        vals = []
        for vid in video_ids:
            s = stat_map.get(vid, {})
            val = s.get(key, 0)
            vals.append(fmt(val if isinstance(val, (int, float)) else 0))
        rows.append(f"| {label} | " + " | ".join(vals) + " |")

    return f"**Confronto video:**\n\n{header}\n{sep}\n" + "\n".join(rows)


@tool
async def get_realtime_all() -> str:
    """Get live viewer counts for ALL videos in the account.
    Use this when the user asks who is watching right now across all videos."""
    raw_videos = await _get("/video")
    videos = _unwrap_data(raw_videos)
    if not videos or not isinstance(videos, list):
        return "Nessun video trovato."

    active = []
    total = 0
    for v in videos[:20]:
        try:
            raw = await _get(f"/stats/video/{v['id']}/live-metrics")
            content = _unwrap_content(raw)
            watching = content.get("watching", 0)
            if watching > 0:
                active.append((v.get("title", v["id"][:12]), watching))
                total += watching
        except Exception:
            pass

    if not active:
        return f"**Real-time:** Nessuno spettatore attivo in questo momento su {len(videos)} video."

    rows = [f"| {name} | {count} |" for name, count in sorted(active, key=lambda x: -x[1])]
    header = "| Video | Spettatori |\n|---|---|"
    return f"**Real-time: {total} spettatori attivi:**\n\n{header}\n" + "\n".join(rows)


def get_vidalytics_tools() -> list:
    """Return all Vidalytics tools for the agent."""
    return [
        get_all_videos_with_stats,
        get_all_videos,
        get_video_stats,
        get_video_timeline,
        get_drop_off,
        get_live_metrics,
        get_api_usage,
        compare_videos,
        get_realtime_all,
    ]

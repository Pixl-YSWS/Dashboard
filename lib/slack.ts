const API = "https://slack.com/api";

function botToken(): string {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error("SLACK_BOT_TOKEN is not set");
  return t;
}

async function slackCall(
  method: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown> & {
    ok: boolean;
    error?: string;
  };
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

let handleCache: { at: number; map: Map<string, string> } | null = null;
const HANDLE_TTL = 10 * 60_000;

// One cached workspace-wide id -> "@handle" map from users.list. Falls back to
// an empty map (callers then show the raw id) when Slack isn't configured or
// the call fails, so this never throws into a page render.
async function loadHandleMap(): Promise<Map<string, string>> {
  if (handleCache && Date.now() - handleCache.at < HANDLE_TTL) return handleCache.map;
  const map = new Map<string, string>();
  if (process.env.SLACK_BOT_TOKEN) {
    try {
      let cursor = "";
      for (let page = 0; page < 20; page++) {
        const res = (await slackCall("users.list", { limit: 200, cursor })) as {
          members?: {
            id?: string;
            name?: string;
            profile?: { display_name?: string };
          }[];
          response_metadata?: { next_cursor?: string };
        };
        for (const u of res.members ?? []) {
          const handle = u.profile?.display_name || u.name;
          if (u.id && handle) map.set(u.id, `@${handle}`);
        }
        cursor = res.response_metadata?.next_cursor ?? "";
        if (!cursor) break;
      }
    } catch (e) {
      console.error("slack users.list failed", (e as Error).message);
    }
  }
  handleCache = { at: Date.now(), map };
  return map;
}

export async function slackHandle(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await loadHandleMap()).get(id) ?? null;
}

export async function slackHandles(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const map = await loadHandleMap();
  const out = new Map<string, string>();
  for (const id of ids) {
    if (!id) continue;
    const h = map.get(id);
    if (h) out.set(id, h);
  }
  return out;
}

// Opens (or reuses) a DM with the user and sends the message.
export async function dmUser(slackUserId: string, text: string): Promise<void> {
  const open = (await slackCall("conversations.open", {
    users: slackUserId,
  })) as { channel?: { id?: string } };
  const channel = open.channel?.id;
  if (!channel) throw new Error("Could not open a DM with that user");
  await slackCall("chat.postMessage", { channel, text });
}

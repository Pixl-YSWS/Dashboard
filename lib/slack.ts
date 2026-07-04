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

// Opens (or reuses) a DM with the user and sends the message.
export async function dmUser(slackUserId: string, text: string): Promise<void> {
  const open = (await slackCall("conversations.open", {
    users: slackUserId,
  })) as { channel?: { id?: string } };
  const channel = open.channel?.id;
  if (!channel) throw new Error("Could not open a DM with that user");
  await slackCall("chat.postMessage", { channel, text });
}

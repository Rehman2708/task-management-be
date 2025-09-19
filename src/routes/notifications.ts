import fetch from "node-fetch";

export async function sendExpoPush(
  expoTokens: string[], // array of device tokens
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  const messages = expoTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
}

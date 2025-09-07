import fetch from "node-fetch";

export async function sendExpoPush(
  expoToken: string,
  title: string,
  body: string,
  data = {}
) {
  const message = { to: expoToken, sound: "default", title, body, data };
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}

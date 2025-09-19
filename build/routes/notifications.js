import fetch from "node-fetch";
export async function sendExpoPush(expoTokens, // array of device tokens
title, body, data = {}) {
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

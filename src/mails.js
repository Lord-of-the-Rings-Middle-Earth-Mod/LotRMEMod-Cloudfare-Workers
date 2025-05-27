export async function handleMails(request, env) {
  try {
    const emailData = await request.json();

    const subject = emailData.headers?.subject || "No Subject";
    const from = emailData.envelope?.from || "Unknown sender";
    const body = emailData.plain || emailData.html || "No content";

    // Beispielhafte Weiterleitung an Discord Webhook
    const discordPayload = {
      content: `📧 New E-Mail from **${from}**:\n**${subject}**\n\n${body.substring(0, 1000)}`
    };

    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload)
    });

    return new Response("E-Mail forwarded to discord.", { status: 200 });
  } catch (err) {
    return new Response("An error occured while forwarding to discord.", { status: 500 });
  }
}

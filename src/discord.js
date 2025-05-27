// The function to post messages to Discord
export async function postToDiscord(webhookUrl, payload) {
    // Send the HTTP POST request to Discord with the webhook URL and payload
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    // If the request was not successful, return an error response
    if (!response.ok) {
        return new Response(`Discord Webhook Error: ${response.statusText}`, { status: 500 });
    }
    
    // If the request was successful, return a success response
    return new Response("Success", { status: 200 });
}

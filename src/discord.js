// The function to post messages to Discord
export async function postToDiscord(webhookUrl, payload) {
    try {
        console.log(`Posting to Discord webhook: ${webhookUrl.substring(0, 50)}...`);
        console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
        
        // Send the HTTP POST request to Discord with the webhook URL and payload
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        // Log response details for debugging
        console.log(`Discord API response status: ${response.status} ${response.statusText}`);
        
        // If the request was not successful, get the error details
        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.text();
                console.error(`Discord API error details: ${errorDetails}`);
            } catch (e) {
                errorDetails = response.statusText;
            }
            return new Response(`Discord Webhook Error: ${response.status} ${response.statusText} - ${errorDetails}`, { status: 500 });
        }
        
        console.log('Discord message posted successfully');
        
        // Get the response data to extract thread information if needed
        let responseData = null;
        try {
            responseData = await response.json();
            console.log('Discord API response data:', JSON.stringify(responseData, null, 2));
        } catch (e) {
            console.log('No JSON response data available');
        }
        
        // Return success response with Discord API data
        return new Response(JSON.stringify({ 
            success: true, 
            discordResponse: responseData 
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Error posting to Discord:', error);
        return new Response(`Discord posting failed: ${error.message}`, { status: 500 });
    }
}

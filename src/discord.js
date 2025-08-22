// The function to post messages to Discord with rate limiting and retry logic
export async function postToDiscord(webhookUrl, payload, maxRetries = 3) {
    const request = async (attempt = 1) => {
        try {
            console.log(`Posting to Discord webhook (attempt ${attempt}/${maxRetries + 1}): ${webhookUrl.substring(0, 50)}...`);
            if (attempt === 1) {
                console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
            }
            
            // Send the HTTP POST request to Discord with the webhook URL and payload
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // Log response details for debugging
            console.log(`Discord API response status: ${response.status} ${response.statusText}`);
            
            // Handle rate limiting (429 Too Many Requests)
            if (response.status === 429) {
                if (attempt <= maxRetries) {
                    // Get retry-after header from Discord (in seconds)
                    const retryAfter = response.headers.get('retry-after');
                    const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000; // Exponential backoff fallback
                    
                    console.log(`Rate limited by Discord. Retrying in ${retryDelay}ms (attempt ${attempt}/${maxRetries})`);
                    
                    // Wait for the specified time before retrying
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return request(attempt + 1);
                } else {
                    console.error(`Maximum retry attempts (${maxRetries}) exceeded for rate limiting`);
                    return new Response(`Discord rate limit exceeded: Maximum retries reached after ${maxRetries} attempts`, { status: 429 });
                }
            }
            
            // If the request was not successful for other reasons, get the error details
            if (!response.ok) {
                let errorDetails;
                try {
                    errorDetails = await response.text();
                    console.error(`Discord API error details: ${errorDetails}`);
                } catch (e) {
                    errorDetails = response.statusText;
                }
                
                // For 5xx errors, retry with exponential backoff
                if (response.status >= 500 && attempt <= maxRetries) {
                    const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                    console.log(`Server error ${response.status}. Retrying in ${retryDelay}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return request(attempt + 1);
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
            console.error(`Error posting to Discord (attempt ${attempt}):`, error);
            
            // Retry on network errors
            if (attempt <= maxRetries) {
                const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`Network error. Retrying in ${retryDelay}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return request(attempt + 1);
            }
            
            return new Response(`Discord posting failed: ${error.message}`, { status: 500 });
        }
    };
    
    return request();
}

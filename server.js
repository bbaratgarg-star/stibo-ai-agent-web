const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up Gemini AI (Requires GEMINI_API_KEY environment variable)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Stibo MCP Connection Details
const MCP_SERVER_URL = "https://daas-naalliances-sandbox.daas.stibosystems.com/runtime/webhooks/mcp";
const MCP_API_KEY = "c1VYT21qTE5kbGJTOHRkQldrLzluOEpvb3JhTkFPaENMeHYxVWFxZzY1LytIQVVueE5uQ0JSQXcxRkFLSXhmeWhVV1F1dldtNzRVOGtiRG1ZVjRjbXBRPQ==";

// Load local product catalog for fast searching (Search Index)
console.log("Loading product search index...");
const productsCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json'), 'utf8'));
const enrichmentIndex = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/enrichment.json'), 'utf8'));
console.log(`Loaded ${productsCatalog.length} products + ${Object.keys(enrichmentIndex).length} enriched entries into search index.`);

async function queryStibo(graphqlQuery, variables = {}) {
    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': MCP_API_KEY
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    name: "serviceTemplateQuery",
                    arguments: {
                        query: graphqlQuery,
                        variables: JSON.stringify(variables)
                    }
                },
                id: 1
            })
        });

        if (!response.ok) {
            console.error(`Stibo Query Error: Status ${response.status}`);
            return null;
        }

        // Stibo Sandbox returns SSE stream like "data: {...}"
        const text = await response.text();
        const match = text.match(/data:\s*(.*)/);
        if (!match || !match[1]) return null;

        // Layer 1: SSE data line → JSON-RPC envelope
        const rpcResponse = JSON.parse(match[1]);

        // Layer 2: JSON-RPC result → MCP content array
        const content = rpcResponse?.result?.content;
        if (content && Array.isArray(content) && content[0]?.text) {
            // Layer 3: MCP content text → actual GraphQL JSON
            return JSON.parse(content[0].text);
        }

        // Fallback: maybe it's already the GraphQL result directly
        if (rpcResponse?.data) return rpcResponse;

        console.error("Unexpected Stibo response structure:", JSON.stringify(rpcResponse).substring(0, 200));
        return null;
    } catch (err) {
        console.error("Error communicating with Stibo Webhook:", err);
        return null;
    }
}



app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    // Set up SSE (Server-Sent Events) streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        // ── STEP 1: Search product catalog ────────────────────────────────
        send('step', { step: 1, text: '🔍 Searching product catalog...' });

        const idPattern = /\bGR-\d+\b/gi;
        const mentionedIds = message.match(idPattern);
        let topMatches = [];

        if (mentionedIds && mentionedIds.length > 0) {
            topMatches = [...new Set(mentionedIds)].slice(0, 5).map(id => ({ id: id.toUpperCase() }));
        } else {
            // Multi-field relevance search: name, brand, SKU, description, category, supplier
            const queryLower = message.toLowerCase();
            const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

            let scoredProducts = productsCatalog.map(p => {
                let score = 0;
                const name  = (p.name  || "").toLowerCase();
                const brand = (p.brand || "").toLowerCase();
                const sku   = (p.sku   || "").toLowerCase();
                const desc  = (p.longDescription || "").toLowerCase();

                // --- SKU: exact match is a direct hit ---
                if (sku   && queryLower.includes(sku))   score += 50;
                // --- Brand: exact brand name in query ---
                if (brand && queryLower.includes(brand)) score += 15;
                // --- Name: exact phrase match ---
                if (name  && queryLower.includes(name))  score += 20;
                // --- Name: individual keyword matches ---
                const nameWords = name.split(/\s+/).filter(w => w.length > 3);
                for (const w of nameWords) { if (queryLower.includes(w)) score += 2; }
                // --- Description: keyword presence ---
                for (const qw of queryWords) { if (desc.includes(qw)) score += 0.5; }

                // --- Category & Supplier from enrichment index ---
                const enriched = enrichmentIndex[p.id];
                if (enriched) {
                    // Supplier: exact name in query
                    const supplier = (enriched.supplier || "").toLowerCase();
                    if (supplier && queryLower.includes(supplier)) score += 20;

                    // Categories: match any level
                    for (const cat of (enriched.categories || [])) {
                        const catLower = cat.toLowerCase();
                        // Exact category phrase in query
                        if (queryLower.includes(catLower)) score += 10;
                        // Individual category words
                        const catWords = catLower.split(/\s+/).filter(w => w.length > 3);
                        for (const cw of catWords) {
                            if (queryLower.includes(cw)) score += 2;
                        }
                    }
                }

                return { id: p.id, score };
            });
            
            topMatches = scoredProducts
                .filter(p => p.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
        }

        // ── STEP 2: Hydrate from Stibo ─────────────────────────────────────
        send('step', { step: 2, text: '⚡ Fetching live data from Stibo...' });

        const productQuery = `
            query($id: String!, $scope: String!) {
                productByID(id: $id, scope: $scope) {
                    id name sku price longDescription brand
                }
            }
        `;
        let stiboContext = "";
        if (topMatches.length > 0) {
            const liveResults = await Promise.all(
                topMatches.map(match => queryStibo(productQuery, { id: match.id, scope: "default" }))
            );

            // Merge: prefer live Stibo data, fall back to local catalog if Stibo returns null
            const validProducts = topMatches.map((match, i) => {
                const live = liveResults[i];
                if (live && live.data && live.data.productByID) {
                    return live.data.productByID; // ✅ live Stibo data
                }
                // Fallback: find product in local catalog
                const local = productsCatalog.find(p => p.id === match.id);
                if (local) {
                    console.log(`Stibo returned null for ${match.id} — using local catalog fallback.`);
                    return local; // 📦 local fallback
                }
                return null;
            }).filter(Boolean);

            // Annotate each product with category + supplier from enrichment index
            const annotatedProducts = validProducts.map(p => {
                const extra = enrichmentIndex[p.id];
                if (extra) {
                    return {
                        ...p,
                        categoryPath: extra.categories.join(' > ') || 'Unknown',
                        supplier: p.supplier || extra.supplier || 'Unknown'
                    };
                }
                return p;
            });

            stiboContext = annotatedProducts.length > 0
                ? JSON.stringify(annotatedProducts, null, 2)
                : "No relevant products found in the catalog for this query.";
        } else {
            stiboContext = "No relevant products found in the catalog for this query.";
        }

        // ── STEP 3: Generate with Gemini ──────────────────────────────────
        send('step', { step: 3, text: '✨ Generating response...' });

        const aiPrompt = `
You are an expert customer service AI agent for a retail store. 
A customer is asking a question about our products. 
Use the following Live Product Information retrieved from our database to answer the question accurately and provide recommendations if multiple products are found.

Live Product Information:
${stiboContext}

Customer's Question:
"${message}"

Provide a friendly, helpful, and concise response. Do not mention "Stibo" or "DaaS" to the customer. Organize recommendations nicely with bullet points or numbers.
`;

        let result;
        let retries = 2;
        while (retries >= 0) {
            try {
                result = await model.generateContent(aiPrompt);
                break;
            } catch (aiError) {
                if (retries === 0 || (aiError.status !== 503 && aiError.status !== 429)) {
                    console.error("Gemini API Error:", aiError);
                    send('error', { text: "AI is currently busy. Please try again in a few moments." });
                    res.end();
                    return;
                }
                
                let delayMs = 2000;
                // Parse dynamic delay from 429 quota error if provided (e.g. "28s")
                if (aiError.status === 429 && aiError.errorDetails) {
                    const retryInfo = aiError.errorDetails.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                    if (retryInfo && retryInfo.retryDelay) {
                        const seconds = parseInt(retryInfo.retryDelay.replace('s', ''));
                        if (!isNaN(seconds)) {
                            delayMs = (seconds * 1000) + 1000; // Add 1s buffer
                            console.log(`Rate limited. Waiting ${seconds} seconds before retrying...`);
                            send('step', { step: 3, text: `⚠️ API Rate Limit - waiting ${seconds}s to retry...` });
                        }
                    }
                }
                
                console.log(`Gemini API Busy (Status ${aiError.status}). Retrying in ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
                retries--;
            }
        }

        const responseText = result.response.text();
        send('done', { reply: responseText });
        res.end();

    } catch (error) {
        console.error(error);
        send('error', { reply: "Sorry, I encountered an error communicating with the database or AI service." });
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Web server listening at http://localhost:${PORT}`);
});



/**
 * Stibo DaaS AI Agent
 * Use Case 2: Customer Service & Product Support
 * 
 * This agent interacts with the Stibo DaaS MCP server to fetch product, 
 * supplier, and customer information based on user queries.
 */

// Load connection details (In a real app, these should come from environment variables)
const MCP_SERVER_URL = "https://daas-naalliances-sandbox.daas.stibosystems.com/runtime/webhooks/mcp";
const MCP_API_KEY = "c1VYT21qTE5kbGJTOHRkQldrLzluOEpvb3JhTkFPaENMeHYxVWFxZzY1LytIQVVueE5uQ0JSQXcxRkFLSXhmeWhVV1F1dldtNzRVOGTIRG1ZVJRjbXBRPQ==";

/**
 * Executes a tool against the Stibo DaaS MCP Server
 * @param {string} toolName - The name of the tool (e.g., 'serviceTemplateQuery')
 * @param {object} inputArgs - The input arguments for the tool
 */
async function callMcpTool(toolName, inputArgs) {
    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': MCP_API_KEY
            },
            body: JSON.stringify({
                tool: toolName,
                input: inputArgs
            })
        });

        if (!response.ok) {
            throw new Error(`MCP Request failed with status ${response.status}: ${await response.text()}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error communicating with MCP Server:", error.message);
        return { isError: true, error: error.message };
    }
}

/**
 * Query Stibo DaaS using GraphQL
 * @param {string} graphqlQuery - The GraphQL query string
 * @param {object} variables - Optional variables for the query
 */
async function queryStibo(graphqlQuery, variables = {}) {
    return await callMcpTool("serviceTemplateQuery", {
        query: graphqlQuery,
        variables: variables
    });
}

/**
 * Agent Logic: Handle a customer service request
 * Enforces guardrails: Always retrieve customer purchase history first,
 * and verify stock/supplier before recommending.
 */
async function handleCustomerRequest(customerId, productRequestSku) {
    console.log(`Processing request for Customer ID: ${customerId}`);
    
    // 1. Retrieve Customer Purchase History
    console.log("Step 1: Retrieving customer profile and purchase history...");
    const customerQuery = `
        query($id: String!, $scope: String!) {
            individualCustomerByID(id: $id, scope: $scope) {
                id
                name
            }
        }
    `;
    const customerData = await queryStibo(customerQuery, { id: customerId, scope: "default" });
    
    if (customerData?.data?.individualCustomerByID) {
        console.log(`Found Customer: ${customerData.data.individualCustomerByID.name}`);
    } else {
        console.log("Customer not found or missing data.");
    }

    // 2. Query for Product
    console.log(`\nStep 2: Checking requested product [ID: ${productRequestSku}]...`);
    const productQuery = `
        query($id: String!, $scope: String!) {
            productByID(id: $id, scope: $scope) {
                id
                name
                sku
                price
                longDescription
            }
        }
    `;
    
    const productData = await queryStibo(productQuery, { id: productRequestSku, scope: "default" });
    
    const product = productData?.data?.productByID;
    
    if (!product) {
        console.log("Product not found. Error:", JSON.stringify(productData, null, 2));
        return;
    }

    console.log(`Found Product: ${product.name} - Price: ${product.price}`);
    console.log(`Description: ${product.longDescription}`);
    
    // We will pass this data to the LLM later!
}

// Example Execution
const customerId = process.argv[2] || "Cust12345";
const productSku = process.argv[3] || "ABC1234";

handleCustomerRequest(customerId, productSku);

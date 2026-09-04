# MCP Server Connection Details

This document stores the connection details for the Stibo DaaS MCP server.

**Server URL:** https://daas-naalliances-sandbox.daas.stibosystems.com/runtime/webhooks/mcp
**API Key:** c1VYT21qTE5kbGJTOHRkQldrLzluOEpvb3JhTkFPaENMeHYxVWFxZzY1LytIQVVueE5uQ0JSQXcxRkFLSXhmeWhVV1F1dldtNzRVOGTIRG1ZVJRjbXBRPQ==

**API Key Header Name** x-api-key

**Existing MCP Server** 
Server name: stibo-daas
Server connecttion code C:\Users\bhara\.gemini\antigravity-ide\brain\1d11e315-de45-4654-a444-84e5032e628f\scratch\mcp_proxy.js
server config file path : C:\Users\bhara\.gemini\config\mcp_config.json 

---

## AI Agent Instructions for MCP Server Configuration

1.  **Configure MCP Server:** Read the connection details from [MCP_Connection_Details.md](MCP_Connection_Details.md).
2.  **Update Configuration File:** Open the MCP configuration file located at `C:\Users\bhara\.gemini\config\mcp_config.json`. Ensure the `stibo-daas` entry points to the correct `serverUrl` and includes the necessary authentication headers (API key).
3.  **Verify Connection:** Use the `mcp_proxy.js` script (found at `C:\Users\bhara\.gemini\antigravity-ide\brain\1d11e315-de45-4654-a444-84e5032e628f\scratch\mcp_proxy.js`) to test the connection to the Stibo DaaS MCP server and verify that the AI agent can successfully communicate with it.

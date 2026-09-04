# Coding Assistant Context Document

## 1. Documentation Grounding
**System Prompt / `.cursorrules` Inclusion:**
To prevent the AI from hallucinating non-existent API endpoints or data models, the following must be embedded into the root `.cursorrules` or `system_prompt.md` file:
- **Stibo STEP Developer Documentation:** Include references to the official Stibo STEP API, specifically focusing on the GraphQL endpoints for querying product data and the MCP (Model Context Protocol) integration for AI agents.
- **Custom Java Extension Components:** Define any custom Java extensions used in the project, mapping their inputs, outputs, and business logic so the AI understands available custom operations.
- **Data Model Definitions:** Provide the specific data models used for Use Case 2 (Customer Service & Product Support), including product details, repair parts, and supplier inventory.

## 2. Logic Constraints
**Asset Transitions & Business Rules:**
- **Validation Checks:** All asset transitions must be validated against the OfferDAM architecture.
- **Business Actions:** The AI must generate Stibo JavaScript business rules that strictly enforce these transitions.
- **Constraint Enforcement:** Ensure that the generated JavaScript rules check for mandatory attributes (e.g., product availability, repair part compatibility) before allowing state changes.

## 3. Testing Workflows
**STEP Business Rule Test VSIX Plugin:**
- **Code Formatting:** The AI must output JavaScript business rules formatted specifically for execution and validation via the STEP Business Rule Test VSIX plugin within Visual Studio Code.
- **Validation:** Instruct the AI to include necessary boilerplate or mock data structures to allow seamless testing of the business rules within the IDE plugin.
- **Define the Data Merge Strategy:** In your Data Model Definitions, explicitly document how the historical transaction data (orders.xlsx and orderrows.xlsx) merges with the live Stibo STEP catalog. The AI needs to know that orderrows.ProductID maps to a specific Stibo STEP attribute (like SKU or internal ID).  
- **State the Expected Output Format:** Under the testing workflows, explicitly state that the AI should use the stibo-step-mcp-server integration patterns (e.g., executing GraphQL queries via tools) rather than attempting to write raw REST API calls.

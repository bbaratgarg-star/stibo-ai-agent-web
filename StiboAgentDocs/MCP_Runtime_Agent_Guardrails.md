# MCP Runtime Agent Guardrails

## 1. Strict Service Instructions
**Agent Behavior Directives:**
- Use the `PATCH /services/{service}/mcp` endpoint to inject explicit rules into the `instructions` field of the MCP service configuration.
- **Core Instruction:** Instruct the agent to *only* suggest alternative products or repair parts that are explicitly verified against the supplier inventory data (e.g., checking `stockQuantity` or `supplierAvailability`). The agent must not guess or hallucinate product availability.

## 2. Context Token Management
**Tool Exposure Limiting:**
- Limit the number of exposed MCP tools to the absolute minimum required for Use Case 2 (Customer Service & Product Support).
- Expose only the specific `<service>GetSchema` and `<service>Query` tools relevant to product support and supplier inventory.
- Rationale: Passing too many tool definitions into the context window pushes out the system instructions, which is a primary trigger for runtime hallucinations.

## 3. Schema Clarity
**GraphQL Schema Optimization:**
- **Semantic Field Names:** Optimize the Stibo GraphQL schema by using descriptive, domain-specific field names (e.g., use `repairParts` or `alternativeProducts` instead of generic names like `children` or `items`).
- **Direct Attribute Access:** Use direct attribute mapping directives such as `@mapValueAsString`, `@mapValueAsInt`, or `@mapValueAsFloat` to expose commonly-used attributes directly on the object.
- **Avoid Nested Arrays:** Avoid requiring the agent to navigate complex, generic nested arrays (e.g., `values: [AttributeValue]`).
- **Benefit:** This eliminates structural ambiguity, allowing the agent to parse the catalog accurately and construct correct queries on the first attempt.

- **Include Customer Profile Guardrails:** Since this is a customer service use case, the agent will handle customer data. Add a guardrail instructing the agent to always retrieve the customer's purchase history first (using CustomerID) before recommending a repair part or alternative product.
- **Define Handling for Missing Data:** Add a section under Strict Service Instructions detailing what the agent should do if a product is out of stock or missing data. For example: "If a recommended alternative product is out of stock, the agent must inform the representative and autonomously search for the next best alternative, rather than failing silently."
- **Specify Query Pagination:** In the Schema Clarity section, add a note that the agent must use Stibo's pagination features (e.g., pageElements and pageInfo) when searching for products or spare parts to avoid overwhelming the context window.  
/* 
 * STEP Business Rule Test VSIX Compatible Script
 * 
 * Target Type: Product
 * Context: Validation / Asset Transition (OfferDAM)
 * Description: Validates that a product has sufficient stock and a valid supplier 
 * before allowing a state transition to "Available for Service".
 */

// Boilerplate/mock for VSIX local testing
if (typeof node === 'undefined') {
    var node = {
        getID: function() { return "PROD-1234"; },
        getName: function() { return "Example Hardware Part"; },
        getValue: function(attrID) {
            if (attrID === "StockQuantity") return { getSimpleValue: function() { return "15"; } };
            if (attrID === "Availability") return { getSimpleValue: function() { return "InStock"; } };
            return { getSimpleValue: function() { return null; } };
        },
        queryReferences: function(refType) {
            if (refType === "ProductToSupplier") {
                return {
                    asList: function(max) {
                        return [{ getTarget: function() { return { getID: function() { return "SUP-999"; }}; } }];
                    }
                };
            }
            return { asList: function() { return []; } };
        }
    };
    var logger = {
        info: function(msg) { console.log("INFO:", msg); },
        warning: function(msg) { console.log("WARN:", msg); }
    };
    var manager = {}; 
}

// -------------------------------------------------------------
// BUSINESS RULE LOGIC
// -------------------------------------------------------------
function validateServiceTransition(node, manager, logger) {
    logger.info("Validating transition for node: " + node.getID() + " - " + node.getName());

    // 1. Check Stock Quantity (Guardrail: Do not recommend out of stock items)
    var stockVal = node.getValue("StockQuantity").getSimpleValue();
    var stockQuantity = stockVal ? parseInt(stockVal, 10) : 0;

    if (stockQuantity <= 0) {
        throw new Error("Validation Failed: Cannot transition product to 'Available for Service' because Stock Quantity is 0.");
    }

    // 2. Check Availability Flag
    var availability = node.getValue("Availability").getSimpleValue();
    if (availability !== "InStock") {
        throw new Error("Validation Failed: Product availability is not 'InStock'.");
    }

    // 3. Check Supplier Mapping (Guardrail: Must have verified supplier inventory)
    var supplierRefs = node.queryReferences("ProductToSupplier").asList(10);
    if (supplierRefs.length === 0) {
        throw new Error("Validation Failed: Product must be linked to a Supplier before it can be offered for service.");
    }

    logger.info("Validation successful. Product is ready for customer service and fulfillment.");
    return true;
}

// Execute the rule (for local testing)
try {
    validateServiceTransition(node, manager, logger);
} catch (e) {
    console.error(e.message);
}

/**
 * CONSTANTS CONFIGURATION STORAGE RUNTIME LAYER
 */
window.ConfigService = class ConfigService {
    static getDefaults() {
        return {
            "APOLLO": "JB Web Delivery",
            "GRAB": "Grab",
            "FOODPANDA": "Foodpanda"
        };
    }

    // Instantly reads the configuration from global memory
    static load() {
        if (window.PIM_CONSTANTS) {
            return window.PIM_CONSTANTS;
        }
        console.warn("Could not find window.PIM_CONSTANTS from constants.js, using engine defaults.");
        return this.getDefaults();
    }

    // Generates a downloadable clean text block structured to update your /data/constants.js
    static saveAsFile(obj) {
        const payloadString = `window.PIM_CONSTANTS = ${JSON.stringify(obj, null, 4)};`;
        const blob = new Blob([payloadString], { type: "application/javascript" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "constants.js"; // Name of the file to replace in your data folder
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/**
 * MODULE 1: EXCEL IO INGESTION DATA SERVICE
 */
window.ExcelReader = class ExcelReader {
    static async read(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: "array" });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const parsed = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }
}

/**
 * MODULE 2: RELATIONAL CORE PRICE ENGINE
 */
window.PriceEngine = class PriceEngine {
    constructor() {
        this.FILE2_COL = { ID: 0, PRODUCT: 2, SKU: 3, IRONMAN_REFERENCE_SKU: 4, PIM_CLASS: 5, PIM_PARENT: 7, PIM_MULTIPLIER: 8, PIM_MULTIPLIER_ID: 9, PIM_CORE_MENU: 10, PIM_CATEGORIES: 11, PIM_SKU: 12, PIM_STATUS: 13 };
        this.FILE1_COL = { SKU: 1, PICKUP: 2, APOLLO: 7, GRAB: 12, FOODPANDA: 17 };
    }

    createPriceLookupMap(f1Data) {
        const lookup = {};
        for (let i = 0; i < f1Data.length; i++) {
            const row = f1Data[i];
            if (!row || row.length < 2) continue;
            let skuKey = String(row[this.FILE1_COL.SKU] ?? "").trim();
            if (!skuKey || skuKey.toLowerCase() === "sku" || skuKey.toLowerCase() === "product") continue;
            lookup[skuKey] = { rawRow: row, mapped: false };
        }
        return lookup;
    }

    createRowByIdMap(f2Data) {
        const lookup = {};
        for (let i = 1; i < f2Data.length; i++) {
            const row = f2Data[i];
            if (!row || row.length === 0) continue;
            let idKey = String(row[this.FILE2_COL.ID] ?? "").trim();
            if (idKey) lookup[idKey] = row;
        }
        return lookup;
    }

    /**
     * core logic adjustment:
     * Calculates values using the substituted base product prices whenever a multiplier ID redirect occurs.
     */
    calculateValue(basePriceRow, parentPriceRow, startIdx, offset, childMul = 1, parentMul = 1, sourceRows , productId) {
        const targetKey = startIdx + offset;

        // If the targeted base product price record wasn't found in File 1, fallback to empty
        if (!basePriceRow) return '';

        // Base calculation uses the price row of the product identified via the mul id override rule
        let rawChildPrice = parseFloat(basePriceRow[startIdx + offset]) || 0;
        let childPrice = rawChildPrice * childMul;

        let rawParentPrice = parentPriceRow ? (parseFloat(parentPriceRow[startIdx + offset]) || 0) : 0;
        let parentPrice = rawParentPrice * parentMul;

        if(rawChildPrice <= 0 || childPrice < parentPrice) {
            
            let sourceRow       = null;
            let pickUpPriceRow = null;

            // PICKUP PRICE
            if (sourceRows?.length > 1) {

                const FP_PIM_DATA     = sourceRows[0];
                const GF_PIM_DATA     = sourceRows[1];
                const APOLLO_PIM_DATA = sourceRows[2];

                const findValidPickupRow = (data) => {

                    if (!Array.isArray(data)) return null;

                    const row = data.find(row =>
                        Array.isArray(row) &&
                        String(row[0]).trim() === String(productId).trim()
                    );

                    if (!row) return null;

                    const pickupPrice = parseFloat(row[12]);

                    return pickupPrice >= 0 ? row : null;
                };

                // APOLLO → GF → FP
                pickUpPriceRow = findValidPickupRow(APOLLO_PIM_DATA);

                if (!pickUpPriceRow) {
                    pickUpPriceRow = findValidPickupRow(GF_PIM_DATA);
                }

                if (!pickUpPriceRow) {
                    pickUpPriceRow = findValidPickupRow(FP_PIM_DATA);
                }
            }

            // DELIVERY PRICE
            if (sourceRows?.length === 1 && Array.isArray(sourceRows[0])) {
                sourceRow = sourceRows[0].find(row =>
                    String(row[0]).trim() === String(productId).trim()
                );
            }
            

            if(productId){
                // console.log("DATA" ,
                //     [{
                //         "PRODUCT_ID"    : productId,
                //         "BASE PRICE"    : basePriceRow,
                //         "PARENT PRICE"  : parentPriceRow,
                //         "SOURCE ROW"    : sourceRow,
                //         "INDEX"         : targetKey
                //     }]
                // )

                switch (targetKey) {
                    // PICKUP
                    case 2:
                        return pickUpPriceRow?.[12] ?? "NEED VALIDATION";

                    case 3:
                        return pickUpPriceRow?.[10] ?? "NEED VALIDATION";

                    case 4:
                        return pickUpPriceRow?.[4] ?? "NEED VALIDATION";

                    case 5:
                        return pickUpPriceRow?.[6] ?? "NEED VALIDATION";

                    case 6:
                        return pickUpPriceRow?.[8] ?? "NEED VALIDATION";

                    // DELIVERY
                    case 7:
                    case 12:
                    case 17:
                        return sourceRow?.[11] ?? '';

                    case 8:
                    case 13:
                    case 18:
                        return sourceRow?.[9] ?? '';

                    case 9:
                    case 14:
                    case 19:
                        return sourceRow?.[3] ?? '';

                    case 10:
                    case 15:
                    case 20:
                        return sourceRow?.[5] ?? '';

                    case 11:
                    case 16:
                    case 21:
                        return sourceRow?.[7] ?? '';

                    default:
                        return "CHECKPOINT";
                }
            }
        }
         
        return Number((childPrice - parentPrice).toFixed(2));
    }
}

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
        this.FILE2_COL = { ID: 0, PRODUCT: 2, SKU: 3, IRONMAN_REFERENCE_SKU: 4, PIM_CLASS: 5, PIM_PARENT: 7, PIM_MULTIPLIER: 8, PIM_MULTIPLIER_ID: 9 };
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
    calculateValue(basePriceRow, parentPriceRow, startIdx, offset, childMul = 1, parentMul = 1) {
        // If the targeted base product price record wasn't found in File 1, fallback to 0
        if (!basePriceRow) return 0;
        
        // Base calculation uses the price row of the product identified via the mul id override rule
        let rawChildPrice = parseFloat(basePriceRow[startIdx + offset]) || 0;
        let childPrice = rawChildPrice * childMul;
        
        let rawParentPrice = parentPriceRow ? (parseFloat(parentPriceRow[startIdx + offset]) || 0) : 0;
        let parentPrice = rawParentPrice * parentMul;
        
        return Number((childPrice - parentPrice).toFixed(2));
    }
}
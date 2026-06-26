
class UIController {
    constructor(engine) {
        this.engine = engine;
        this.state = { file1: [], file2: [], exportRows: [], unmappedSkus: [] };
        this.constants = window.ConfigService.load();
    }

    renderRawTemplateTable(data) {
        let html = "";
        data.slice(0, 15).forEach((row, rIdx) => {
            if (!row || row.length === 0) return;
            let isHeader = rIdx === 0;
            html += `<tr class="${isHeader ? 'bg-slate-950 text-slate-300 font-bold border-b border-slate-800' : 'hover:bg-slate-850/30 border-b border-slate-850'}">`;
            row.slice(0, 20).forEach(cell => {
                html += `<td class="p-2 whitespace-nowrap overflow-hidden max-w-xs truncate border-r border-slate-850">${cell ?? ""}</td>`;
            });
            html += "</tr>";
        });
        if (data.length > 15) {
            html += `<tr><td colspan="20" class="p-2 text-center text-slate-500 bg-slate-950/20 italic font-mono text-[10px]">Active view clipped loop at row boundary...</td></tr>`;
        }
        $("#table1").html(html);
    }

    buildExportButtons() {
        const markup = `
            <button type="button" data-channel="${this.constants.APOLLO}" class="export-btn w-full bg-emerald-900/80 text-emerald-200 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-emerald-800 transition flex items-center justify-between border border-emerald-800/60">
                <span><i class="fa-solid fa-globe mr-2 text-emerald-400"></i> Export ${this.constants.APOLLO}</span>
                <i class="fa-solid fa-arrow-down-long text-emerald-400"></i>
            </button>
            <button type="button" data-channel="${this.constants.GRAB}" class="export-btn w-full bg-amber-950/80 text-amber-200 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-amber-800 transition flex items-center justify-between border border-amber-900/60">
                <span><i class="fa-solid fa-motorcycle mr-2 text-amber-400"></i> Export ${this.constants.GRAB}</span>
                <i class="fa-solid fa-arrow-down-long text-amber-400"></i>
            </button>
            <button type="button" data-channel="${this.constants.FOODPANDA}" class="export-btn w-full bg-pink-950/80 text-pink-200 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-pink-800 transition flex items-center justify-between border border-pink-900/60">
                <span><i class="fa-solid fa-bowl-food mr-2 text-pink-400"></i> Export ${this.constants.FOODPANDA}</span>
                <i class="fa-solid fa-arrow-down-long text-pink-400"></i>
            </button>
        `;
        $("#export-button-target-group").html(markup);
    }

    processEnginePipelines() {
        // Core configuration variables load runtime tracking parameters
        this.constants = window.ConfigService.load();
        this.buildExportButtons();

        const priceMap = this.engine.createPriceLookupMap(this.state.file1);
        const f2IdMap = this.engine.createRowByIdMap(this.state.file2);

        this.state.exportRows = [];
        let html = this.generateTableHeaderMarkup();
        let matchesCount = 0;

        html += `<tbody class="divide-y divide-slate-800 text-slate-300 bg-slate-900/40">`;

        for (let i = 1; i < this.state.file2.length; i++) {
            const row = this.state.file2[i];
            if (!row || row.length === 0 || row[this.engine.FILE2_COL.ID] === "ID") continue;

            let refSku = String(row[this.engine.FILE2_COL.IRONMAN_REFERENCE_SKU] ?? "").trim();
            let mulParId = String(row[this.engine.FILE2_COL.PIM_MULTIPLIER_ID] ?? "").trim();

            let rowMultiplier = parseFloat(row[this.engine.FILE2_COL.PIM_MULTIPLIER]) || 1;
            if (rowMultiplier <= 0) rowMultiplier = 1;

            let targetPriceContext = priceMap[refSku];
            let isInheritedFallback = false;

            if (mulParId && mulParId !== "" && mulParId !== "ZERO") {
                let fallbackRow = f2IdMap[mulParId];
                if (fallbackRow) {
                    let fallbackRefSku = String(fallbackRow[this.engine.FILE2_COL.IRONMAN_REFERENCE_SKU] ?? "").trim();
                    if (priceMap[fallbackRefSku]) {
                        targetPriceContext = priceMap[fallbackRefSku];
                        priceMap[fallbackRefSku].mapped = true;
                        isInheritedFallback = true;
                    }
                }
            }
            else if (targetPriceContext) {
                priceMap[refSku].mapped = true;
            }

            if (!targetPriceContext) continue;
            matchesCount++;
            let matchedPriceRow = targetPriceContext.rawRow;

            let parentId = String(row[this.engine.FILE2_COL.PIM_PARENT] ?? "").trim();
            let parentPriceRow = null;
            let parentMultiplier = 1;

            if (parentId && parentId !== "" && parentId !== "ZERO" && !isNaN(parentId)) {
                let parentRow = f2IdMap[parentId];
                if (parentRow) {
                    let parentRefSku = String(parentRow[this.engine.FILE2_COL.IRONMAN_REFERENCE_SKU] ?? "").trim();
                    if (priceMap[parentRefSku]) {
                        parentPriceRow = priceMap[parentRefSku].rawRow;
                        parentMultiplier = parseFloat(parentRow[this.engine.FILE2_COL.PIM_MULTIPLIER]) || 1;
                        if (parentMultiplier <= 0) parentMultiplier = 1;
                    }
                }
            }

            html += `<tr class="hover:bg-slate-850/60 transition border-b border-slate-800/60 ${isInheritedFallback ? 'bg-indigo-950/20' : ''}">
                <td class="p-2 bg-slate-950 font-bold border-r border-slate-800 text-slate-200 text-center">${row[this.engine.FILE2_COL.ID] ?? ""}</td>
                <td class="p-2 font-normal max-w-[160px] truncate border-r border-slate-800 text-slate-100">${row[this.engine.FILE2_COL.PRODUCT] ?? ""}</td>
                <td class="p-2 font-mono text-slate-500 text-[10px] border-r border-slate-800">${row[this.engine.FILE2_COL.SKU] ?? ""}</td>
                <td class="p-2 font-mono border-r border-slate-800 ${isInheritedFallback ? 'text-indigo-400/60 line-through text-[9px]' : 'text-indigo-400 font-bold'}">${row[this.engine.FILE2_COL.IRONMAN_REFERENCE_SKU] ?? ""}</td>
                <td class="p-2 text-center border-r border-slate-800 text-slate-400">${row[this.engine.FILE2_COL.PIM_CLASS] ?? ""}</td>
                <td class="p-2 text-center border-r border-slate-800 ${parentId && parentId !== 'ZERO' ? 'text-purple-400 font-bold bg-purple-950/40' : 'text-slate-500'}">${parentId || '—'}</td>
                <td class="p-2 text-center border-r border-slate-800 font-mono font-bold ${rowMultiplier !== 1 ? 'text-amber-400 bg-amber-950/20' : 'text-slate-400'}">${row[this.engine.FILE2_COL.PIM_MULTIPLIER] ?? ""}</td>
                <td class="p-2 text-center border-r border-slate-800 ${isInheritedFallback ? 'bg-indigo-950 text-indigo-300 font-black border-indigo-900' : 'text-slate-500'}">${row[this.engine.FILE2_COL.PIM_MULTIPLIER_ID] ?? ""}</td>
                
                ${this.buildCells(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.PICKUP, "bg-blue-950/10", "border-blue-900/40", rowMultiplier, parentMultiplier)}
                ${this.buildCells(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.APOLLO, "bg-emerald-950/10", "border-emerald-900/40", rowMultiplier, parentMultiplier)}
                ${this.buildCells(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.GRAB, "bg-amber-950/10", "border-amber-900/40", rowMultiplier, parentMultiplier)}
                ${this.buildCells(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.FOODPANDA, "bg-pink-950/10", "border-pink-900/40", rowMultiplier, parentMultiplier, true)}
            </tr>`;

            this.stageExportRows(row, f2IdMap, mulParId, refSku, isInheritedFallback, matchedPriceRow, parentPriceRow, rowMultiplier, parentMultiplier);
        }

        html += "</tbody>";
        document.getElementById("table2").innerHTML = html;
        $("#t2-count").text(`${matchesCount} Records Generated`);

        this.state.unmappedSkus = Object.keys(priceMap).filter(sku => !priceMap[sku].mapped).map(sku => ({
            sku: sku,
            desc: priceMap[sku].rawRow[0] || "No Description Data Provided"
        }));

        this.updateAuditInterface();
    }

    buildCells(cRow, pRow, startIdx, bg, border, cMul, pMul, isLast = false) {
        let out = "";
        for (let offset = 0; offset < 5; offset++) {
            let finalPrice = this.engine.calculateValue(cRow, pRow, startIdx, offset, cMul, pMul);
            let color = pRow ? "text-purple-400 font-bold" : "text-slate-300";
            let bStyle = `border-r ${border}`;
            if (offset === 4 && !isLast) bStyle = "border-r border-slate-700";
            if (offset === 4 && isLast) bStyle = "";
            out += `<td class="p-1.5 text-center font-mono text-[11px] ${bg} ${bStyle} ${color}">${finalPrice}</td>`;
        }
        return out;
    }

    stageExportRows(row, f2IdMap, mulParId, refSku, isInheritedFallback, matchedPriceRow, parentPriceRow, rowMultiplier, parentMultiplier) {
        // Uses custom reference constants values
        const Channel = [
            { name: this.constants.APOLLO, startIdx: this.engine.FILE1_COL.APOLLO },
            { name: this.constants.GRAB, startIdx: this.engine.FILE1_COL.GRAB },
            { name: this.constants.FOODPANDA, startIdx: this.engine.FILE1_COL.FOODPANDA }
        ];
        Channel.forEach(ch => {
            this.state.exportRows.push({
                "Product ID": row[this.engine.FILE2_COL.ID] ?? "",
                "Name": row[this.engine.FILE2_COL.PRODUCT] ?? "",
                "Channel": ch.name,
                // "ironman_reference_sku": isInheritedFallback ? String(f2IdMap[mulParId]?.[this.engine.FILE2_COL.IRONMAN_REFERENCE_SKU] ?? "") : refSku,
                "10% Delivery - Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, ch.startIdx, 2, rowMultiplier, parentMultiplier),
                "10% Delivery - Pickup Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.PICKUP, 2, rowMultiplier, parentMultiplier),
                "15% Delivery - Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, ch.startIdx, 3, rowMultiplier, parentMultiplier),
                "15% Delivery - Pickup Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.PICKUP, 3, rowMultiplier, parentMultiplier),
                "20% Delivery - Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, ch.startIdx, 4, rowMultiplier, parentMultiplier),
                "20% Delivery - Pickup Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.PICKUP, 4, rowMultiplier, parentMultiplier),
                "5% Delivery - Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, ch.startIdx, 1, rowMultiplier, parentMultiplier),
                "5% Delivery - Pickup Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.PICKUP, 1, rowMultiplier, parentMultiplier),
                "Standard Delivery - Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, ch.startIdx, 0, rowMultiplier, parentMultiplier),
                "Standard Delivery - Pickup Price": this.engine.calculateValue(matchedPriceRow, parentPriceRow, this.engine.FILE1_COL.PICKUP, 0, rowMultiplier, parentMultiplier),
                "Core Menu": row[this.engine.FILE2_COL.PIM_CORE_MENU] ?? "", // Maps directly from structure schema if index exists
                "Categories": row[this.engine.FILE2_COL.PIM_CATEGORIES] ?? "", // Falls back to class if blank
                "SKU": row[this.engine.FILE2_COL.PIM_SKU] ?? "", // Active product structural stock identifier
                "Status": row[this.engine.FILE2_COL.PIM_STATUS] ?? "", // Extracts custom assignment or falls back safely to 'Active'
                "QMAI Product Code": "",
                "QMAI SKU": "",
                "QMAI ID Group": "",
            });
        });
    }

    updateAuditInterface() {
        const totalExceptions = this.state.unmappedSkus.length;
        $("#unmapped-badge").text(totalExceptions);
        if (totalExceptions > 0) {
            $("#audit-card").removeClass("hidden");
            let listHtml = "";
            this.state.unmappedSkus.forEach(item => {
                listHtml += `<div class="p-2.5 flex items-center justify-between hover:bg-slate-900 transition">
                    <span class="font-mono text-red-400 font-bold">${item.sku}</span>
                    <span class="text-[11px] text-slate-500 text-right truncate max-w-[320px]">${item.desc}</span>
                </div>`;
            });

            // Render to BOTH the sidebar card preview and the main diagnostics modal container
            $("#unmapped-list-container").html(listHtml);
            $("#unmapped-list-modal").html(listHtml);
        } else {
            $("#audit-card").addClass("hidden");
        }
    }

    generateTableHeaderMarkup() {
        return `<thead class="sticky top-0 z-20 text-[10px] uppercase font-bold tracking-wider text-center text-slate-200 select-none shadow">
            <tr class="border-b border-slate-950 bg-slate-950">
                <th rowspan="2" class="p-2 text-left border-r border-slate-800 min-w-[50px]">ID</th>
                <th rowspan="2" class="p-2 text-left border-r border-slate-800 min-w-[140px]">PRODUCT</th>
                <th rowspan="2" class="p-2 text-left border-r border-slate-800 min-w-[80px]">SKU</th>
                <th rowspan="2" class="p-2 text-left border-r border-slate-800 min-w-[90px]">IRONMAN SKU</th>
                <th rowspan="2" class="p-2 border-r border-slate-800 min-w-[70px]">CLASS</th>
                <th rowspan="2" class="p-2 border-r border-slate-800 min-w-[60px]">PARENT</th>
                <th rowspan="2" class="p-2 border-r border-slate-800 min-w-[60px]">MULTIPLIER</th>
                <th rowspan="2" class="p-2 border-r border-slate-800 min-w-[70px]">MULT ID</th>
                <th colspan="5" class="p-1.5 bg-blue-950/80 text-blue-300 border-r border-slate-800">Pickup Matrix</th>
                <th colspan="5" class="p-1.5 bg-emerald-950/80 text-emerald-300 border-r border-slate-800">${this.constants.APOLLO} Matrix</th>
                <th colspan="5" class="p-1.5 bg-amber-950/80 text-amber-300 border-r border-slate-800">${this.constants.GRAB} Matrix</th>
                <th colspan="5" class="p-1.5 bg-pink-950/80 text-pink-300">${this.constants.FOODPANDA} Matrix</th>
            </tr>
            <tr class="text-[9px] bg-slate-900 border-b border-slate-800">
                ${'<th>REG</th><th>5%</th><th>10%</th><th>15%</th><th class="border-r border-slate-700">20%</th>'.repeat(3)}
                <th>REG</th><th>5%</th><th>10%</th><th>15%</th><th>20%</th>
            </tr>
        </thead>`;
    }

    flushState() {
        this.state = { file1: [], file2: [], exportRows: [], unmappedSkus: [] };
        $("#file1, #file2").val("");
        $("#file1-label").text("Load matrix sheet").removeClass("text-blue-400 font-bold");
        $("#file2-label").text("Load structure map").removeClass("text-emerald-400 font-bold");
        $("#t1-count").text("Empty Stack");
        $("#t2-count").text("Unprocessed");
        $("#export-card, #audit-card, #unmapped-modal").addClass("hidden");
        $("#table1").html('<tbody><tr><td class="p-4 text-center text-slate-500 italic font-normal">Awaiting data sheet ingestion...</td></tr></tbody>');
        $("#table2").html('<tbody><tr><td class="p-12 text-center text-slate-500 italic font-normal">No relational models generated.</td></tr></tbody>');
    }
}

$(document).ready(() => {
    const coreEngine = new window.PriceEngine();
    const ui = new UIController(coreEngine);

    // Initial button render using active settings profile map
    ui.buildExportButtons();

    // Configuration Settings Modal Actions
    $("#open-settings").on("click", () => {
        $("#cfg-apollo").val(ui.constants.APOLLO);
        $("#cfg-grab").val(ui.constants.GRAB);
        $("#cfg-foodpanda").val(ui.constants.FOODPANDA);

        // DYNAMIC FOLDER RESOLUTION LOGIC
        try {
            // Decode URI component to get rid of browser characters like %20 in paths
            let rawPath = decodeURIComponent(window.location.pathname);

            // Strip off index.html from the trailing edge
            let folderPath = rawPath.substring(0, rawPath.lastIndexOf('/'));

            // Clean up Windows formatting if it retains an unnecessary leading slash (e.g., /D:/folder)
            if (folderPath.startsWith('/') && folderPath.charAt(2) === ':') {
                folderPath = folderPath.substring(1);
            }

            // Inject the precise data destination target text link straight into the card layout view
            $("#dynamic-data-directory").html(`<i class="fa-solid fa-folder-open text-[9px] text-indigo-400 mr-1"></i>${folderPath}/data/`);
        } catch (e) {
            $("#dynamic-data-directory").text("./data/");
        }

        $("#settings-modal").removeClass("hidden");
    });

    $("#close-settings-modal").on("click", () => $("#settings-modal").addClass("hidden"));

    $("#reset-settings-btn").on("click", () => {
        const defaults = window.ConfigService.getDefaults();
        $("#cfg-apollo").val(defaults.APOLLO);
        $("#cfg-grab").val(defaults.GRAB);
        $("#cfg-foodpanda").val(defaults.FOODPANDA);
    });

    $("#save-settings-btn").on("click", () => {
        const updatedConstants = {
            APOLLO: $("#cfg-apollo").val().trim() || "JB Web Delivery",
            GRAB: $("#cfg-grab").val().trim() || "Grab",
            FOODPANDA: $("#cfg-foodpanda").val().trim() || "Foodpanda"
        };

        // Triggers the download pipeline cleanly
        window.ConfigService.saveAsFile(updatedConstants);

        // Update temporary layout execution contexts immediately
        ui.constants = updatedConstants;
        ui.buildExportButtons();

        if (ui.state.file2.length > 0) {
            ui.processEnginePipelines();
        }

        $("#settings-modal").addClass("hidden");
    });

    // Ingestion File Pipelines
    $("#file1").on("change", async function () {
        if (this.files[0]) {
            try {
                $("#file1-label").text(this.files[0].name).addClass("text-blue-400 font-bold");
                ui.state.file1 = await window.ExcelReader.read(this.files[0]);
                $("#t1-count").text(`${ui.state.file1.length} Rows Staged`);
            } catch (err) {
                alert("Runtime IO Exception Parsing File 1");
            }
        }
    });

    $("#file2").on("change", async function () {
        if (this.files[0]) {
            try {
                $("#file2-label").text(this.files[0].name).addClass("text-emerald-400 font-bold");
                ui.state.file2 = await window.ExcelReader.read(this.files[0]);
            } catch (err) {
                alert("Runtime IO Exception Parsing File 2");
            }
        }
    });

    $("#process").on("click", (e) => {
        e.preventDefault();
        if (!ui.state.file1.length || !ui.state.file2.length) {
            alert("Validation Error: Please supply targets for both processing queues before calculations run.");
            return;
        }
        ui.renderRawTemplateTable(ui.state.file1);
        ui.processEnginePipelines();
        $("#export-card").removeClass("hidden");
    });

    $("#clear-all").on("click", (e) => { e.preventDefault(); ui.flushState(); });
    $("#view-unmapped").on("click", () => $("#unmapped-modal").removeClass("hidden"));
    $("#close-modal, #close-modal-btn").on("click", () => $("#unmapped-modal").addClass("hidden"));

    // Event Delegation handling for dynamic download handlers
    $("#export-button-target-group").on("click", ".export-btn", function (e) {
        e.preventDefault();
        const chName = $(this).attr("data-channel");
        const rows = ui.state.exportRows.filter(r => r["Channel"] === chName);
        if (!rows.length) return alert(`No record mutations staged for channel value: ${chName}`);

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Calculated Channel Matrix");
        XLSX.writeFile(wb, `PIM_${chName.replace(/\s+/g, '_')}.xlsx`);
    });
});
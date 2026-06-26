let parsedDataset = [];
let categoryDirectoryMap = {};
let addonsDirectoryMap = {};
let componentsDirectoryMap = {}; // Tracks structural metadata for raw ingredients
let activeCategoryGlobal = "";
let activeAddonGlobal = "";
let activeComponentGlobal = "";
let activeTabGlobal = "main-products"; // Core Tabs: 'main-products' | 'condiments' | 'components'
let activeSubDisplayMode = "grid";     // Display States: 'grid' | 'table'

$(document).ready(function () {
    // Dynamic sidebar mounting
    $("#sidebar-container").load("../shared/sidebar.html", function () {
        const currentViewKey = "mapping";
        const targetLink = $(`[data-nav="${currentViewKey}"]`);
        targetLink.removeClass("text-slate-400 hover:text-white hover:bg-slate-800/50")
            .addClass("sidebar-link-active text-white bg-indigo-600/10 border border-indigo-500/20 text-indigo-400");
    });

    // Ingestion File Uploader Pipeline Listener
    $('#csv-uploader').on('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        $('#csv-file-label').text(file.name).addClass('text-indigo-400 font-bold');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: function (results) {
                processUploadedData(results.data);
            }
        });
    });

    // Top Sub-nav Select Dropdown handling contextual actions
    $('#category-dropdown').on('change', function () {
        const pickedValue = $(this).val() || this.value;
        if (!pickedValue) return;

        if (activeTabGlobal === "condiments") {
            activeAddonGlobal = pickedValue;
        } else if (activeTabGlobal === "components") {
            activeComponentGlobal = pickedValue;
        } else {
            activeCategoryGlobal = pickedValue;
        }
        renderInnerWorkspaceView("table");
    });

    // Return to root directory layout button trigger (Fixed from old type error)
    $('#back-to-grid-trigger').on('click', function () {
        renderInnerWorkspaceView("grid");
    });

    $('#clear-state').on('click', function () {
        resetPipelineEngine();
    });

    // Card routing dispatch listeners
    $(document).on('click', '.category-nav-card', function () {
        activeCategoryGlobal = $(this).data('category-target');
        $('#category-dropdown').val(activeCategoryGlobal);
        renderInnerWorkspaceView("table");
    });

    $(document).on('click', '.addon-nav-card', function () {
        activeAddonGlobal = $(this).data('addon-target');
        $('#category-dropdown').val(activeAddonGlobal);
        renderInnerWorkspaceView("table");
    });

    $(document).on('click', '.component-nav-card', function () {
        activeComponentGlobal = $(this).data('component-target');
        $('#category-dropdown').val(activeComponentGlobal);
        renderInnerWorkspaceView("table");
    });

    // Inspect Modifiers Dynamic Dialog Event delegation path
    $(document).on('click', '.view-modifiers-trigger', function () {
        const rowId = $(this).data('row-idx');
        const record = parsedDataset[rowId];
        if (!record) return;

        const ids = record.modifier_ids ? String(record.modifier_ids).split(',') : [];
        const okyaIds = record.okya_modifier_ids ? String(record.okya_modifier_ids).split(',') : [];
        const names = record.modifier_names ? String(record.modifier_names).split(',') : [];

        $('#modal-product-title').text(record.product_name || "Unknown Item");
        $('#modal-product-sku').text(record.product_sku || record.sku_reference || "N/A");

        const modalBodyTable = $('#modal-modifiers-tbody');
        modalBodyTable.empty();
        const maxLoops = Math.max(ids.length, names.length);

        for (let i = 0; i < maxLoops; i++) {
            let modId = (ids[i] || '').trim();
            let okyaId = (okyaIds[i] || '').trim();
            let modName = (names[i] || '').trim();
            if (!modId && !modName && !okyaId) continue;

            modalBodyTable.append(`
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td class="p-3 font-mono text-indigo-400">${modId || '-'}</td>
                    <td class="p-3 font-mono text-slate-400">${okyaId || '-'}</td>
                    <td class="p-3 text-white font-medium">${modName || 'Unnamed Package Selection'}</td>
                </tr>
            `);
        }
        $('#modifiers-modal-backdrop').removeClass('hidden').addClass('flex');
    });

    $('.close-modal-action').on('click', function () {
        $('#modifiers-modal-backdrop').addClass('hidden').removeClass('flex');
    });

    // Tab switcher controller routing logic
    $('.pim-tab').on('click', function () {
        const targetView = $(this).data('tab');
        $('.pim-tab').removeClass('active border-indigo-500 text-indigo-400').addClass('border-transparent text-slate-400');
        $(this).addClass('active border-indigo-500 text-indigo-400').removeClass('border-transparent text-slate-400');

        activeTabGlobal = targetView;
        renderInnerWorkspaceView("grid");
    });

    $('#global-search-box').on('input', function () {
        const searchTerm = $(this).val().toLowerCase().trim();

        if (activeSubDisplayMode === "grid") {
            if (searchTerm === "") {
                $('#cards-grid-container > div').show();
            } else {
                $('#cards-grid-container > div').each(function () {
                    const card = $(this);

                    // 1. Grab target mapping references based on current tab view context
                    const categoryTarget = card.data('category-target');
                    const addonTarget = card.data('addon-target');
                    const componentTarget = card.data('component-target');

                    let matchesInnerContent = false;

                    // 2. Perform contextual search across deep dataset elements
                    if (activeTabGlobal === "main-products" && categoryTarget) {
                        if (categoryTarget.toLowerCase().includes(searchTerm)) {
                            matchesInnerContent = true;
                        } else {
                            matchesInnerContent = parsedDataset.some(row => {
                                if (!row.category_names) return false;
                                const belongsToCat = row.category_names.split(',').map(c => c.trim().toLowerCase()).includes(categoryTarget.toLowerCase());
                                const nameMatches = (row.product_name || '').toLowerCase().includes(searchTerm);
                                return belongsToCat && nameMatches;
                            });
                        }
                    } else if (activeTabGlobal === "condiments" && addonTarget) {
                        if (addonTarget.toLowerCase().includes(searchTerm)) {
                            matchesInnerContent = true;
                        } else {
                            matchesInnerContent = parsedDataset.some(row => {
                                if (!row.add_on_names) return false;
                                const belongsToAddon = row.add_on_names.split(',').map(a => a.trim().toLowerCase()).includes(addonTarget.toLowerCase());
                                const nameMatches = (row.product_name || '').toLowerCase().includes(searchTerm);
                                return belongsToAddon && nameMatches;
                            });
                        }
                    } else if (activeTabGlobal === "components" && componentTarget) {
                        if (componentTarget.toLowerCase().includes(searchTerm)) {
                            matchesInnerContent = true;
                        } else {
                            matchesInnerContent = parsedDataset.some(row => {
                                if (!row.components) return false;
                                const utilizesComponent = row.components.split(',').map(c => c.trim().toLowerCase()).includes(componentTarget.toLowerCase());
                                const nameMatches = (row.product_name || '').toLowerCase().includes(searchTerm);
                                return utilizesComponent && nameMatches;
                            });
                        }
                    }

                    // Toggle visibility based on title OR deep content match
                    if (matchesInnerContent) {
                        card.show();
                    } else {
                        card.hide();
                    }
                });
            }
        } else {
            // Context State 2: Filter row pipelines matching table criteria
            if (searchTerm === "") {
                $('#output-matrix-table tbody tr').show();
            } else {
                $('#output-matrix-table tbody tr').each(function () {
                    const rowText = $(this).text().toLowerCase();
                    if (rowText.includes(searchTerm)) {
                        $(this).show();
                    } else {
                        $(this).hide();
                    }
                });

                const visibleRows = $('#output-matrix-table tbody tr:visible').length;
                if (visibleRows === 0 && $('#output-matrix-table tbody tr').length > 0) {
                    if ($('#search-empty-fallback').length === 0) {
                        $('#output-matrix-table tbody').append(`
                            <tr id="search-empty-fallback">
                                <td colspan="6" class="p-12 text-center text-slate-600 italic">No items matched your current search parameter.</td>
                            </tr>
                        `);
                    }
                } else {
                    $('#search-empty-fallback').remove();
                }
            }
        }
    });

    // Automatically reset text elements when shifting primary context tab routes
    $('.pim-tab, #back-to-grid-trigger, #category-dropdown').on('click change', function () {
        $('#global-search-box').val('');
    });
});

// Central workspace rendering router
function renderInnerWorkspaceView(mode) {
    activeSubDisplayMode = mode;
    repopulateContextDropdown();

    if (mode === "grid") {
        $('#table-matrix-view').hide();
        $('#back-to-grid-trigger').hide();
        $('#grid-overview-view').show();

        if (activeTabGlobal === "condiments") {
            renderAddonsGrid();
        } else if (activeTabGlobal === "components") {
            renderComponentsGrid();
        } else {
            renderCategoriesGrid();
        }
    } else {
        $('#grid-overview-view').hide();
        if (parsedDataset.length > 0) $('#back-to-grid-trigger').css('display', 'inline-flex');
        $('#table-matrix-view').show();

        if (activeTabGlobal === "condiments") {
            renderFilteredAddonProductsTable(activeAddonGlobal);
        } else if (activeTabGlobal === "components") {
            renderFilteredComponentProductsTable(activeComponentGlobal);
        } else {
            renderFilteredTargetCategoryTable(activeCategoryGlobal);
        }
    }
}

// Dynamically repopulates select options relative to selected primary tab profile with IDs
function repopulateContextDropdown() {
    const dropdownElement = $('#category-dropdown');
    dropdownElement.empty();

    if (parsedDataset.length === 0) {
        dropdownElement.append('<option value="">Awaiting active ingestion pipeline...</option>').prop('disabled', true);
        return;
    }

    if (activeTabGlobal === "condiments") {
        dropdownElement.append('<option value="">-- Select active target add-on node --</option>');
        Object.keys(addonsDirectoryMap).sort((a, b) => a.localeCompare(b)).forEach(addon => {
            const addonMeta = addonsDirectoryMap[addon];
            const displayId = addonMeta && addonMeta.id ? addonMeta.id : 'N/A';
            dropdownElement.append(`<option value="${addon}">(${displayId}) ${addon}</option>`);
        });
        dropdownElement.val(activeAddonGlobal);
    } else if (activeTabGlobal === "components") {
        dropdownElement.append('<option value="">-- Select active target component node --</option>');
        Object.keys(componentsDirectoryMap).sort((a, b) => a.localeCompare(b)).forEach(comp => {
            dropdownElement.append(`<option value="${comp}">(CMP) ${comp}</option>`);
        });
        dropdownElement.val(activeComponentGlobal);
    } else {
        dropdownElement.append('<option value="">-- Select active target category node --</option>');
        Object.keys(categoryDirectoryMap).sort((a, b) => a.localeCompare(b)).forEach(cat => {
            const catMeta = categoryDirectoryMap[cat];
            const displayId = catMeta && catMeta.id ? catMeta.id : 'VAR';
            dropdownElement.append(`<option value="${cat}">(${displayId}) ${cat}</option>`);
        });
        dropdownElement.val(activeCategoryGlobal);
    }
}

// Helper to normalize and match single unified categories
function getNormalizedCategory(categoryName) {
    if (!categoryName) return '';
    let name = categoryName.trim();
    let lower = name.toLowerCase();
    if (lower === "fries" || lower === "side" || lower === "extras" || lower === "fries, side & extras") {
        return "Fries, Side & Extras";
    }
    return name;
}

// Ingestion dataset parse formatting sequence maps mapping references
function processUploadedData(rawArray) {
    categoryDirectoryMap = {};
    addonsDirectoryMap = {};
    componentsDirectoryMap = {};

    parsedDataset = rawArray.map((row, idx) => {
        let normalizedRow = { _internal_index: idx };
        for (let key in row) {
            if (row.hasOwnProperty(key)) {
                let cleanKey = key.trim().replace(/^"|"$/g, '');
                normalizedRow[cleanKey] = row[key] !== null ? String(row[key]).trim() : '';
            }
        }

        // Re-normalize categories column directly inside the parsed storage engine
        if (normalizedRow.category_names) {
            let parts = normalizedRow.category_names.split(',').map(c => getNormalizedCategory(c));
            normalizedRow.category_names = parts.filter((val, i, arr) => arr.indexOf(val) === i).join(', ');
        }
        return normalizedRow;
    });

    parsedDataset.forEach(row => {
        // 1. Process Normalized Categories
        if (row.category_names) {
            let names = row.category_names.split(',');
            let ids = row.category_ids ? String(row.category_ids).split(',') : [];
            names.forEach((name, i) => {
                let cleanName = name.trim();
                if (cleanName && cleanName.toLowerCase() !== 'nan') {
                    if (!categoryDirectoryMap[cleanName]) {
                        // Inherit ID or fallback
                        categoryDirectoryMap[cleanName] = { id: ids[i] ? ids[i].trim() : 'VAR', count: 0 };
                    }
                    categoryDirectoryMap[cleanName].count++;
                }
            });
        }

        // 2. Process Add-ons
        if (row.add_on_names) {
            let addonNames = row.add_on_names.split(',');
            let addonIds = row.add_on_ids ? String(row.add_on_ids).split(',') : [];
            addonNames.forEach((name, i) => {
                let cleanName = name.trim();
                if (cleanName && cleanName.toLowerCase() !== 'nan') {
                    if (!addonsDirectoryMap[cleanName]) {
                        addonsDirectoryMap[cleanName] = { id: addonIds[i] ? addonIds[i].trim() : 'N/A', count: 0 };
                    }
                    addonsDirectoryMap[cleanName].count++;
                }
            });
        }

        // 3. Process Components
        if (row.components) {
            let compNames = row.components.split(',');
            compNames.forEach(name => {
                let cleanName = name.trim();
                if (cleanName && cleanName.toLowerCase() !== 'nan') {
                    if (!componentsDirectoryMap[cleanName]) {
                        componentsDirectoryMap[cleanName] = { count: 0 };
                    }
                    componentsDirectoryMap[cleanName].count++;
                }
            });
        }
    });

    const discoveredCategories = Object.keys(categoryDirectoryMap).sort((a, b) => a.localeCompare(b));
    const discoveredAddons = Object.keys(addonsDirectoryMap).sort((a, b) => a.localeCompare(b));
    const discoveredComponents = Object.keys(componentsDirectoryMap).sort((a, b) => a.localeCompare(b));

    if (discoveredCategories.length > 0) activeCategoryGlobal = discoveredCategories[0];
    if (discoveredAddons.length > 0) activeAddonGlobal = discoveredAddons[0];
    if (discoveredComponents.length > 0) activeComponentGlobal = discoveredComponents[0];

    $('#category-dropdown').prop('disabled', false)
        .removeClass('cursor-not-allowed text-slate-400')
        .addClass('text-indigo-400 border-indigo-500/30 bg-slate-950');

    renderInnerWorkspaceView("grid");
}

// Render Main Products grid directory screen
function renderCategoriesGrid() {
    const gridContainer = $('#cards-grid-container').empty();
    const categoriesList = Object.keys(categoryDirectoryMap).sort((a, b) => a.localeCompare(b));

    $('#record-counter').html(`<span class="text-indigo-400 font-bold">${categoriesList.length} Categories</span> mapped under Main Products`)
        .removeClass().addClass('text-[10px] font-mono bg-slate-950 text-blue-400 border border-blue-900 px-2.5 py-1 rounded-md font-bold bg-blue-950/40');

    categoriesList.forEach(catName => {
        const catMeta = categoryDirectoryMap[catName];
        gridContainer.append(`
            <div data-category-target="${catName}" class="category-nav-card bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 shadow-md cursor-pointer transition transform hover:-translate-y-0.5 group flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between mb-2">
                        <span class="text-[10px] font-mono tracking-wider text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">ID: ${catMeta.id}</span>
                        <i class="fa-solid fa-folder text-slate-700 group-hover:text-indigo-500 text-sm"></i>
                    </div>
                    <h4 class="text-xs font-bold text-slate-200 group-hover:text-white transition line-clamp-2">${catName}</h4>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400 font-medium"><span class="text-emerald-400 font-bold font-mono">${catMeta.count}</span> items inside</span>
                    <span class="text-[10px] text-indigo-400 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Inspect Matrix <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                </div>
            </div>
        `);
    });
}

// Render Condiments grid directory screen
function renderAddonsGrid() {
    const gridContainer = $('#cards-grid-container').empty();
    const addonsList = Object.keys(addonsDirectoryMap).sort((a, b) => a.localeCompare(b));

    $('#record-counter').html(`<span class="text-emerald-400 font-bold">${addonsList.length} Add-on Packages</span> mapped under Condiments`)
        .removeClass().addClass('text-[10px] font-mono bg-slate-950 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded-md font-bold bg-emerald-950/30');

    addonsList.forEach(addonName => {
        const addonMeta = addonsDirectoryMap[addonName];
        gridContainer.append(`
            <div data-addon-target="${addonName}" class="addon-nav-card bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 shadow-md cursor-pointer transition transform hover:-translate-y-0.5 group flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between mb-2">
                        <span class="text-[10px] font-mono tracking-wider text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">ID: ${addonMeta.id}</span>
                        <i class="fa-solid fa-pepper-hot text-slate-700 group-hover:text-emerald-500 text-sm"></i>
                    </div>
                    <h4 class="text-xs font-bold text-slate-200 group-hover:text-white transition line-clamp-2">${addonName}</h4>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400 font-medium"><span class="text-indigo-400 font-bold font-mono">${addonMeta.count}</span> products belong</span>
                    <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">View Products <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                </div>
            </div>
        `);
    });
}

// Render Components grid directory screen
function renderComponentsGrid() {
    const gridContainer = $('#cards-grid-container').empty();
    const componentsList = Object.keys(componentsDirectoryMap).sort((a, b) => a.localeCompare(b));

    $('#record-counter').html(`<span class="text-purple-400 font-bold">${componentsList.length} Recipe Materials</span> mapped under Components`)
        .removeClass().addClass('text-[10px] font-mono bg-slate-950 text-purple-400 border border-purple-900/40 px-2.5 py-1 rounded-md font-bold bg-purple-950/30');

    componentsList.forEach(compName => {
        const compMeta = componentsDirectoryMap[compName];
        gridContainer.append(`
            <div data-component-target="${compName}" class="component-nav-card bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 rounded-xl p-5 shadow-md cursor-pointer transition transform hover:-translate-y-0.5 group flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between mb-2">
                        <span class="text-[10px] font-mono tracking-wider text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">SKU Material</span>
                        <i class="fa-solid fa-cubes text-slate-700 group-hover:text-purple-500 text-sm"></i>
                    </div>
                    <h4 class="text-xs font-bold text-slate-200 group-hover:text-white transition line-clamp-2">${compName}</h4>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400 font-medium"><span class="text-indigo-400 font-bold font-mono">${compMeta.count}</span> usage matrices</span>
                    <span class="text-[10px] text-purple-400 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Trace Formulas <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                </div>
            </div>
        `);
    });
}

// Filter tables by Categories
function renderFilteredTargetCategoryTable(targetCategory) {
    let filteredArray = parsedDataset.filter(row => {
        if (!row.category_names) return false;
        return row.category_names.split(',').map(c => c.trim().toLowerCase()).includes(targetCategory.toLowerCase());
    });
    filteredArray.sort((a, b) => (a.product_name || '').toLowerCase().localeCompare((b.product_name || '').toLowerCase()));

    $('#record-counter').html(`<span class="text-indigo-400 font-bold">${filteredArray.length} Main Items</span> located under: ${targetCategory}`);
    injectDataRowsIntoTableBody(filteredArray, targetCategory, "category");
}

// Filter tables by Add-on packages
function renderFilteredAddonProductsTable(targetAddon) {
    let filteredArray = parsedDataset.filter(row => {
        if (!row.add_on_names) return false;
        return row.add_on_names.split(',').map(a => a.trim().toLowerCase()).includes(targetAddon.toLowerCase());
    });
    filteredArray.sort((a, b) => (a.product_name || '').toLowerCase().localeCompare((b.product_name || '').toLowerCase()));

    $('#record-counter').html(`<span class="text-emerald-400 font-bold">${filteredArray.length} Linked Products</span> map down to Add-on: ${targetAddon}`);
    injectDataRowsIntoTableBody(filteredArray, targetAddon, "addon");
}

// Filter tables by raw ingredient recipe strings
function renderFilteredComponentProductsTable(targetComponent) {
    let filteredArray = parsedDataset.filter(row => {
        if (!row.components) return false;
        return row.components.split(',').map(c => c.trim().toLowerCase()).includes(targetComponent.toLowerCase());
    });
    filteredArray.sort((a, b) => (a.product_name || '').toLowerCase().localeCompare((b.product_name || '').toLowerCase()));

    $('#record-counter').html(`<span class="text-purple-400 font-bold">${filteredArray.length} Formulas</span> utilizing ingredient element: ${targetComponent}`);
    injectDataRowsIntoTableBody(filteredArray, targetComponent, "component");
}

// Common structural row injector
function injectDataRowsIntoTableBody(dataset, currentContextKey, mode) {
    const tableBody = $('#output-matrix-table tbody').empty();
    if (dataset.length === 0) {
        tableBody.append(`<tr><td colspan="6" class="p-16 text-center text-slate-500 italic">No corresponding records available matching dynamic scopes.</td></tr>`);
        return;
    }

    dataset.forEach(row => {
        let displaySubID = "N/A";
        if (mode === "category") {
            let names = row.category_names ? row.category_names.split(',') : [];
            let ids = row.category_ids ? String(row.category_ids).split(',') : [];
            let idx = names.map(c => c.trim().toLowerCase()).indexOf(currentContextKey.toLowerCase());
            if (idx !== -1 && ids[idx]) displaySubID = `Cat ID: ${ids[idx].trim()}`;
        } else if (mode === "addon") {
            let names = row.add_on_names ? row.add_on_names.split(',') : [];
            let ids = row.add_on_ids ? String(row.add_on_ids).split(',') : [];
            let idx = names.map(a => a.trim().toLowerCase()).indexOf(currentContextKey.toLowerCase());
            if (idx !== -1 && ids[idx]) displaySubID = `Addon ID: ${ids[idx].trim()}`;
        } else {
            displaySubID = `Component Core`;
        }

        const hasModifiers = !!(row.modifier_names || row.modifier_ids);
        let inspectButtonMarkup = hasModifiers ? `
            <button class="view-modifiers-trigger text-[10px] px-2 py-1 bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 rounded hover:bg-indigo-900 transition flex items-center justify-center w-max gap-1 focus:outline-none" data-row-idx="${row._internal_index}">
                <i class="fa-solid fa-arrows-to-eye"></i> Inspect Modifiers Matrix
            </button>
        ` : '';

        let modifierSegment = hasModifiers ? `
            <div class="font-medium text-indigo-400 truncate max-w-xs">${row.modifier_names || ''}</div>
            <div class="text-[10px] font-mono text-slate-500 mt-0.5">IDs: ${row.modifier_ids || 'N/A'}</div>
        ` : `<span class="text-slate-600 italic">None</span>`;

        let addonsSegment = row.add_on_names || row.add_on_ids ? `
            <div class="font-medium text-emerald-400 whitespace-normal">${row.add_on_names || ''}</div>
            <div class="text-[10px] font-mono text-slate-500 mt-0.5">Add-on IDs: ${row.add_on_ids || 'N/A'}</div>
        ` : `<span class="text-slate-600 italic">None</span>`;

        let skuValue = row.product_sku || row.sku_reference || '';
        let componentsValue = row.components || row.components_stack || '';

        tableBody.append(`
            <tr class="hover:bg-slate-800/30 transition border-b border-slate-800/40">
                <td class="p-3 font-mono text-slate-400 border-r border-slate-800/40 cursor-pointer hover:bg-slate-800/50 hover:text-indigo-400 transition"
                    onclick="window.open('https://pim.gbtdo.com/products/${row.product_id}', '_blank')">
                    ${row.product_id}
                </td>
                <td class="p-4 font-bold text-white whitespace-normal border-r border-slate-800/40">
                    <div class="flex flex-col gap-1.5">
                        <span>${row.product_name || ''}</span>
                        ${inspectButtonMarkup}
                    </div>
                </td>
                <td class="p-3 font-mono text-slate-500 border-r border-slate-800/40">
                    ${skuValue ? skuValue : '<span class="text-slate-700 italic">No SKU mapping</span>'}
                </td>
                <td class="p-3 border-r border-slate-800/40">${modifierSegment}</td>
                <td class="p-3 border-r border-slate-800/40">${addonsSegment}</td>
                <td class="p-4 text-slate-400 whitespace-normal leading-relaxed">${componentsValue || '<span class="text-slate-700 italic">None</span>'}</td>
            </tr>
        `);
    });
}

function resetPipelineEngine() {
    parsedDataset = [];
    categoryDirectoryMap = {};
    addonsDirectoryMap = {};
    componentsDirectoryMap = {};
    activeCategoryGlobal = "";
    activeAddonGlobal = "";
    activeComponentGlobal = "";
    activeTabGlobal = "main-products";
    $('#csv-uploader').val('');
    $('#csv-file-label').text('Load menu matrix csv').removeClass('text-indigo-400 font-bold');
    $('#category-dropdown').empty().append('<option value="">Awaiting active ingestion pipeline...</option>')
        .prop('disabled', true).addClass('cursor-not-allowed text-slate-400').removeClass('text-indigo-400 border-indigo-500/30 bg-slate-950');
    $('#record-counter').text('Pipeline Empty').removeClass().addClass('text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-2.5 py-1 rounded-md font-bold');
    $('#cards-grid-container').empty();

    $('.pim-tab').removeClass('active border-indigo-500 text-indigo-400').addClass('border-transparent text-slate-400');
    $('[data-tab="main-products"]').addClass('active border-indigo-500 text-indigo-400').removeClass('border-transparent text-slate-400');

    renderInnerWorkspaceView("grid");
    $('#output-matrix-table tbody').html(`<tr><td colspan="6" class="p-16 text-center text-slate-500 italic">No matrix models generated. Upload a structural CSV file to parse context.</td></tr>`);
}
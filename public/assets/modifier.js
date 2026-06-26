let categories = {};
let productMap = {};

// FILE 2 → product uses modifiers
let productToModifiers = {};

// FILE 3 → modifier contains products
let modifierToProducts = {};

const URL_BASE = "https://jfc-pim-staging-1bce623e12de.herokuapp.com/products/";

// =========================
// BUILD ENGINE
// =========================
async function buildEngine() {
    categories = {};
    productMap = {};
    productToModifiers = {};
    modifierToProducts = {};

    const files = [
        document.getElementById("file1").files[0],
        document.getElementById("file2").files[0],
        document.getElementById("file3").files[0]
    ];

    if (files.some(f => !f)) {
        alert("Please upload all 3 files before building the engine.");
        return;
    }

    for (let i = 0; i < files.length; i++) {
        await readExcel(files[i], i + 1);
    }

    renderAll();
    setupSearch();
    renderHealthCheck();
    // alert("Engine built successfully!");
}

// =========================
// PARSE CATEGORIES (Handles Special Case)
// =========================
function parseCategories(catString) {
    if (!catString) return [];
    
    // Edge case: Protect 'Fries, Sides & Extras' from getting sliced by the comma split
    const specialCase = "Fries, Sides & Extras";
    let hasSpecialCase = false;
    
    let processedString = catString;
    if (processedString.includes(specialCase)) {
        hasSpecialCase = true;
        processedString = processedString.replace(specialCase, "___SPECIAL_CAT___");
    }
    
    let cats = processedString.split(',').map(c => c.trim()).filter(Boolean);
    
    if (hasSpecialCase) {
        cats = cats.map(c => c === "___SPECIAL_CAT___" ? specialCase : c);
    }
    
    return cats;
}

// =========================
// READ EXCEL
// =========================
function readExcel(file, fileIndex) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            rows.forEach(r => {
                const id = String(r.id || '').trim();
                if (!id) return;

                // Build uniform global map entries
                productMap[id] = { ...(productMap[id] || {}), ...r };

                // FILE 1 → CATEGORIES MAP
                if (fileIndex === 1 && r.categories) {
                    const parsedCats = parseCategories(String(r.categories));
                    parsedCats.forEach(cat => {
                        categories[cat] = categories[cat] || [];
                        if (!categories[cat].includes(id)) {
                            categories[cat].push(id);
                        }
                    });
                }

                // FILE 2 → MAIN PRODUCT USES MODIFIERS
                if (fileIndex === 2 && r.addon_groups) {
                    productToModifiers[id] = String(r.addon_groups)
                        .split(",")
                        .map(x => x.trim())
                        .filter(Boolean);
                }

                // FILE 3 → MODIFIER GROUP CONTAINS PRODUCTS
                if (fileIndex === 3 && r.addon_groups) {
                    const groups = String(r.addon_groups)
                        .split(",")
                        .map(x => x.trim())
                        .filter(Boolean);

                    groups.forEach(g => {
                        modifierToProducts[g] = modifierToProducts[g] || [];
                        if (!modifierToProducts[g].includes(id)) {
                            modifierToProducts[g].push(id);
                        }
                    });
                }
            });
            resolve();
        };
        reader.readAsArrayBuffer(file);
    });
}

// =========================
// RENDER ALL
// =========================
function renderAll() {
    renderCategories();
    renderProductModifiers();
    renderModifierContents();
}

// =====================================================
// TAB 1: CATEGORIES
// =====================================================
function renderCategories() {
    const el = document.getElementById("view-categories");
    const sortedCats = Object.keys(categories).sort();
    
    if (sortedCats.length === 0) { el.innerHTML = `<p class="text-slate-500 text-xs">No records loaded.</p>`; return; }

    el.innerHTML = sortedCats.map(cat => `
        <div class="p-3 border border-slate-800 mb-2 rounded bg-slate-900/50 flex justify-between items-center searchable-item" 
             data-search="${cat.toLowerCase()}" 
             data-item-key="${cat}">
            <div>
                <div class="font-bold text-slate-200">${cat}</div>
                <div class="text-xs text-slate-500">${categories[cat].length} Linked Products</div>
            </div>
            <button onclick="openCategory('${cat.replace(/'/g, "\\'")}')" class="text-xs bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1.5 rounded transition border border-indigo-500/30">
                View Products
            </button>
        </div>
    `).join("");
}

// =====================================================
// TAB 2: PRODUCT MODIFIERS
// =====================================================
function renderProductModifiers() {
    const el = document.getElementById("view-productModifiers");
    const sortedCats = Object.keys(categories).sort();

    if (sortedCats.length === 0) { el.innerHTML = `<p class="text-slate-500 text-xs">No records loaded.</p>`; return; }

    el.innerHTML = sortedCats.map(cat => `
        <div class="p-3 border border-slate-800 mb-2 rounded bg-slate-900/50 flex justify-between items-center searchable-item" 
             data-search="${cat.toLowerCase()}" 
             data-item-key="${cat}">
            <div>
                <div class="font-bold text-indigo-300">${cat}</div>
                <div class="text-xs text-slate-500">Check relationships per item</div>
            </div>
            <button onclick="openCategoryProducts('${cat.replace(/'/g, "\\'")}')" class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">
                Open Structure
            </button>
        </div>
    `).join("");
}

// =====================================================
// TAB 3: MODIFIER CONTENTS (FILE 3 MATCHES)
// =====================================================
function renderModifierContents() {
    const el = document.getElementById("view-modifierContents");
    const sortedGroups = Object.keys(modifierToProducts).sort();

    if (sortedGroups.length === 0) { el.innerHTML = `<p class="text-slate-500 text-xs">No records loaded.</p>`; return; }

    el.innerHTML = sortedGroups.map(group => `
        <div class="p-3 border border-slate-800 mb-2 rounded bg-slate-900/50 flex justify-between items-center searchable-item" 
             data-search="${group.toLowerCase()}" 
             data-item-key="${group}">
            <div>
                <div class="font-bold text-emerald-400">${group}</div>
                <div class="text-xs text-slate-400">${modifierToProducts[group]?.length || 0} sub-products belong here</div>
            </div>
            <button onclick="openModal('Modifier Group Inventory: ${group.replace(/'/g, "\\'")}', modifierToProducts['${group.replace(/'/g, "\\'")}'])" class="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-3 py-1.5 rounded">
                View Composition
            </button>
        </div>
    `).join("");
}

function openCategory(cat) {
    openModal("Category: " + cat, categories[cat] || []);
}

// =====================================================
// TAB 2: PRODUCT MODIFIERS
// =====================================================
function renderProductModifiers() {
    const el = document.getElementById("view-productModifiers");
    const sortedCats = Object.keys(categories).sort();

    el.innerHTML = sortedCats.map(cat => `
        <div class="p-3 border border-slate-800 mb-2 rounded bg-slate-900/50 flex justify-between items-center searchable-item" data-search="${cat.toLowerCase()}">
            <div>
                <div class="font-bold text-indigo-300">${cat}</div>
                <div class="text-xs text-slate-500">Check relationships per item</div>
            </div>
            <button onclick="openCategoryProducts('${cat.replace(/'/g, "\\'")}')" class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">
                Open Structure
            </button>
        </div>
    `).join("");
}

function openCategoryProducts(cat) {
    openModal("Category Structure: " + cat, categories[cat] || [], showProductModifiers);
}

// Inline toggler for showing sub-modifiers inside the modal workspace
function showProductModifiers(productId, clickedRow) {
    const existing = clickedRow.nextElementSibling;
    if (existing && existing.classList.contains("modifier-row")) {
        existing.remove();
        return;
    }

    const mods = productToModifiers[productId] || [];
    const tr = document.createElement("tr");
    tr.className = "modifier-row";

    tr.innerHTML = `
        <td colspan="4" class="p-4 bg-slate-950 border-y border-slate-800">
            <div class="text-xs font-semibold text-slate-400 mb-2">Modifier Groups Linked to this Product:</div>
            <div class="flex flex-wrap gap-2">
                ${
                    mods.length
                    ? mods.map(m => `
                        <div class="flex flex-col p-2 bg-slate-900 border border-slate-700 rounded text-xs">
                            <span class="text-indigo-300 font-medium">${m}</span>
                            <span class="text-[10px] text-slate-500">${modifierToProducts[m]?.length || 0} items inside this group</span>
                        </div>
                    `).join("")
                    : `<span class="text-slate-500 italic text-xs">No modifier groups attached in File 2</span>`
                }
            </div>
        </td>
    `;
    clickedRow.parentNode.insertBefore(tr, clickedRow.nextSibling);
}

// =====================================================
// TAB 3: MODIFIER CONTENTS (FILE 3 MATCHES)
// =====================================================
function renderModifierContents() {
    const el = document.getElementById("view-modifierContents");
    const sortedGroups = Object.keys(modifierToProducts).sort();

    if (sortedGroups.length === 0) { el.innerHTML = `<p class="text-slate-500 text-xs">No records loaded.</p>`; return; }

    el.innerHTML = sortedGroups.map(group => `
        <div class="p-3 border border-slate-800 mb-2 rounded bg-slate-900/50 flex justify-between items-center searchable-item" data-search="${group.toLowerCase()}">
            <div>
                <div class="font-bold text-emerald-400">${group}</div>
                <div class="text-xs text-slate-400">${modifierToProducts[group]?.length || 0} sub-products belong here</div>
            </div>
            <button onclick="openModal('Modifier Group Inventory: ${group.replace(/'/g, "\\'")}', modifierToProducts['${group.replace(/'/g, "\\'")}'])" class="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-3 py-1.5 rounded">
                View Composition
            </button>
        </div>
    `).join("");
}

// =====================================================
// TAB 4: SYSTEM HEALTH AUDITS
// =====================================================
function renderHealthCheck() {
    const el = document.getElementById("view-health");
    let brokenLinks = 0;
    let crossChecks = [];

    // Diagnostics loop
    Object.keys(productToModifiers).forEach(prodId => {
        const groups = productToModifiers[prodId];
        groups.forEach(g => {
            if (!modifierToProducts[g]) {
                brokenLinks++;
                crossChecks.push(`Product <b>${prodId}</b> requests modifier cluster <b>"${g}"</b> but it doesn't exist anywhere inside File 3.`);
            }
        });
    });

    el.innerHTML = `
        <div class="p-4 rounded border border-slate-800 bg-slate-900/40">
            <h3 class="font-bold mb-2 text-sm text-slate-200">PIM Structural Integrities</h3>
            <div class="grid grid-cols-2 gap-4 my-3 text-xs">
                <div class="bg-slate-950 p-3 rounded border border-slate-800">
                    <span class="text-slate-400 block">Total Distinct Catalog Entries (File 1)</span>
                    <span class="text-xl font-bold text-indigo-400">${Object.keys(productMap).length} items</span>
                </div>
                <div class="bg-slate-950 p-3 rounded border border-slate-800">
                    <span class="text-slate-400 block">Orphaned Modifier Call Errors</span>
                    <span class="text-xl font-bold ${brokenLinks > 0 ? 'text-rose-400' : 'text-emerald-400'}">${brokenLinks} breaks</span>
                </div>
            </div>
            <div class="mt-4">
                <h4 class="text-xs font-bold text-slate-300 mb-2">Error Diagnostic Stream logs</h4>
                <div class="max-h-60 overflow-y-auto text-xs font-mono p-2 bg-slate-950 border border-slate-800 rounded text-slate-400 divide-y divide-slate-900">
                    ${crossChecks.length ? crossChecks.map(log => `<div class="py-1.5">${log}</div>`).join("") : '<div class="text-emerald-500">✔ Clean match! All Modifier requests correctly sync between configurations.</div>'}
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// MODAL ENGINE
// =====================================================
function openModal(title, list, onClick = null) {
    document.getElementById("modal").classList.remove("hidden");
    document.getElementById("modalTitle").innerText = title;

    const body = document.getElementById("modalBody");
    body.innerHTML = "";

    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 text-xs">No child elements mapped.</td></tr>`;
        return;
    }

    list.forEach(id => {
        const p = productMap[id] || {};
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-800/60 hover:bg-slate-800/30 transition text-slate-300";

        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-indigo-400">${id}</td>
            <td class="p-3 font-medium">${p.name || '<span class="text-slate-600">Unresolved Metadata Reference</span>'}</td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">${p.sku || "N/A"}</td>
            <td class="p-3">
                <div class="flex items-center gap-3">
                    <a target="_blank" class="text-indigo-400 underline hover:text-indigo-300 font-medium" href="${URL_BASE + id}">
                        Inspect
                    </a>
                    ${onClick ? `<button class="action-toggle-btn text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Toggle Substructures</button>` : ''}
                </div>
            </td>
        `;

        if (onClick) {
            // Target item triggers logic block on complete row execution click
            const targetTrigger = tr.querySelector('.action-toggle-btn') || tr;
            targetTrigger.style.cursor = "pointer";
            targetTrigger.onclick = (e) => {
                e.stopPropagation();
                onClick(id, tr);
            };
        }
        body.appendChild(tr);
    });
}

// =========================
// INTERACTIVE DEEP SYSTEM SEARCH
// =========================
function setupSearch() {
    document.getElementById("search").oninput = function(e) {
        const val = e.target.value.toLowerCase().trim();
        const currentActiveTab = document.querySelector('.tab-active').getAttribute('onclick');
        
        // Determine which tab view we are currently filtering
        let itemClass = '';
        let lookUpMap = null;

        if (currentActiveTab.includes('categories')) {
            itemClass = '#view-categories .searchable-item';
            lookUpMap = categories;
        } else if (currentActiveTab.includes('productModifiers')) {
            itemClass = '#view-productModifiers .searchable-item';
            lookUpMap = categories; // Shares category list layout
        } else if (currentActiveTab.includes('modifierContents')) {
            itemClass = '#view-modifierContents .searchable-item';
            lookUpMap = modifierToProducts;
        } else {
            return; // Don't search on the Health tab
        }

        document.querySelectorAll(itemClass).forEach(el => {
            // 1. Get the primary group title (Category name or Modifier group name)
            const structuralKey = el.getAttribute('data-item-key'); 
            const mainTitle = el.getAttribute('data-search') || '';
            
            // 2. Gather text metadata from all sub-products attached to this group
            let productMatchText = '';
            const productIdsInGroup = lookUpMap[structuralKey] || [];
            
            productIdsInGroup.forEach(id => {
                const prod = productMap[id] || {};
                const name = (prod.name || '').toLowerCase();
                const sku = (prod.sku || '').toLowerCase();
                const prodId = String(id).toLowerCase();
                
                productMatchText += ` ${name} ${sku} ${prodId}`;
            });

            // 3. Evaluate if the search query hits the group title OR any internal products
            if (mainTitle.includes(val) || productMatchText.includes(val)) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    };
}
// =========================
// TAB SWITCH
// =========================
function switchTab(tab, el) {
    ["categories", "productModifiers", "modifierContents", "health"]
        .forEach(t => document.getElementById("view-" + t).classList.add("hidden"));

    document.getElementById("view-" + tab).classList.remove("hidden");

    document.querySelectorAll(".tab").forEach(b => {
        b.classList.remove("tab-active");
        b.classList.add("bg-slate-800");
    });

    if (el) {
        el.classList.add("tab-active");
        el.classList.remove("bg-slate-800");
    }
}

// =========================
// CLOSE MODAL
// =========================
function closeModal() {
    document.getElementById("modal").classList.add("hidden");
}
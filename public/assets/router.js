$(document).ready(function () {

    // Core routing map supporting multiple script dependencies sequentially
    const routes = {
        '#price': {
            html: './price_engine/view.html',
            scripts: [
                './assets/constants.js',
                './assets/engine.js',
                './assets/app.js'
            ]
        },
        '#mapping': {
            html: './product_mapping/view.html',
            scripts: ['./assets/mapping.js']
        },
        '#modifier': {
            html: './product_modifier/view.html',
            scripts: [
                './assets/modifier.js'
            ]
        }
    };

    // Helper utility to load an array of scripts in a strict sequential order
    function syncLoadScripts(scriptArray, callback) {
        if (!scriptArray || scriptArray.length === 0) {
            if (callback) callback();
            return;
        }

        // Pull the first script in the array queue
        const nextScript = scriptArray[0];
        const remainingScripts = scriptArray.slice(1);

        const scriptElement = document.createElement('script');
        scriptElement.className = 'spa-dynamic-script';
        scriptElement.src = nextScript + '?v=' + new Date().getTime(); // Anti-caching query sequence
        scriptElement.async = false; // Preserves execution order behavior

        scriptElement.onload = function () {
            // Recurse to load the next file down the chain
            syncLoadScripts(remainingScripts, callback);
        };

        scriptElement.onerror = function () {
            console.error(`SPA Engine failed to load dependency: ${nextScript}`);
            syncLoadScripts(remainingScripts, callback); // Keep loop alive on soft drops
        };

        document.body.appendChild(scriptElement);
    }

    function loadViewRouter(hash) {
        const route = routes[hash] || routes['#price'];
        const viewport = $('#spa-main-viewport');

        // 1. Synchronize Sidebar Navigation Active Styles
        $('.sidebar-link').removeClass('text-white bg-indigo-600/10 border border-indigo-500/20 text-indigo-400')
            .addClass('text-slate-400 hover:text-white hover:bg-slate-800/50');

        const activeNavKey = Object.keys(routes).includes(hash) ? hash.replace('#', '') : 'price';
        $(`[data-nav="${activeNavKey}"]`).removeClass('text-slate-400 hover:text-white hover:bg-slate-800/50')
            .addClass('text-white bg-indigo-600/10 border border-indigo-500/20 text-indigo-400');

        // 2. Clear Search Box fields automatically across routes
        $('#global-search-box').val('');

        // 3. Play Smooth View Transition Out
        viewport.addClass('opacity-0');

        setTimeout(() => {
            // 4. Fetch and render pure HTML template context
            viewport.load(route.html, function (response, status, xhr) {
                if (status === "error") {
                    viewport.html(`<div class="p-8 text-rose-400 font-mono text-xs">Failed to load view file.</div>`);
                    viewport.removeClass('opacity-0');
                    return;
                }

                // 5. Purge previous page dynamic scripts from DOM completely
                $('.spa-dynamic-script').remove();

                // 6. Execute the sync script queue array sequence
                syncLoadScripts([...route.scripts], function () {
                    // 7. Fade view back in only when scripts are fully compiled
                    viewport.removeClass('opacity-0');
                });
            });
        }, 150);
    }

    // Hash navigation lifecycle trigger listener
    $(window).on('hashchange', function () {
        loadViewRouter(window.location.hash);
    });

    // Run runtime validation check on boot sequence
    if (!window.location.hash) {
        window.location.hash = '#price';
    } else {
        loadViewRouter(window.location.hash);
    }
});
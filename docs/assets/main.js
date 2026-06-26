$(document).on('click', '.sidebar-link, .sidebar-brand a', function (e) {
    const targetUrl = $(this).attr('href');

    // Don't intercept dead links, external links, or hash targets
    if (!targetUrl || targetUrl === '#' || targetUrl.startsWith('http')) return;

    e.preventDefault(); // Stop the browser from instantly changing pages

    // Add the class to fade out the body
    $('body').addClass('page-exit');

    // Wait for the CSS fade-out transition to finish before switching pages
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 200); // Matches the 0.2s transition inside styles.css
});
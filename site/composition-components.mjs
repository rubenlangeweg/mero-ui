const example = (id, name, description, demo, notes) => ({ id, name, description, demo, code: demo, notes });
const lamp =
  '<img src="/studio-lamp.webp" width="1120" height="747" alt="Arc Task Lamp in warm ivory" loading="lazy">';

export const groups = [
  {
    name: "Composition",
    items: [
      example(
        "join",
        "Join",
        "Connect related controls with a shared outline.",
        `<form class="rl-join" role="search" action="/components"><input class="rl-input" type="search" name="q" aria-label="Find a component" placeholder="Search the library"><button class="rl-button rl-button-primary">Search</button></form>`,
      ),
      example(
        "menu",
        "Menu",
        "Group destinations with an active page and section labels.",
        `<nav class="rl-link-menu" aria-label="Studio guide"><strong>Workspace</strong><a href="/layouts/dashboard" aria-current="page">Overview</a><a href="/layouts/dashboard?view=inventory">Inventory</a><a href="/layouts/dashboard?view=settings">Settings</a></nav>`,
      ),
      example(
        "hero",
        "Hero",
        "Pair a product introduction with a single destination.",
        `<section class="rl-editorial-hero"><div><small>Studio lighting</small><h2>Arc Task Lamp</h2><p>Soft enamel and brushed metal for the desktop.</p><a class="rl-button" href="/components/carousel">View finishes</a></div>${lamp}</section>`,
      ),
      example(
        "footer",
        "Footer",
        "Close a workspace with a small group of navigation links.",
        `<footer class="rl-footer-nav"><strong>Studio</strong><nav aria-label="Studio footer"><a href="/components">Library</a><a href="/layouts">Layouts</a><a href="/start">Docs</a></nav></footer>`,
      ),
      example(
        "theme-controller",
        "Theme Controller",
        "Set a theme inside one section of a page.",
        `<section class="rl-theme-sample" data-rl-theme-scope data-theme="light"><label>Appearance <select class="rl-select" data-rl-theme-picker><option value="light">Daylight</option><option value="dark">After hours</option></select></label><article class="rl-card"><h2 class="rl-card-title">Studio workspace</h2><p class="rl-card-description">The appearance applies to this workspace.</p></article></section>`,
      ),
      example(
        "validator",
        "Validator",
        "Show a native field constraint and its correction.",
        `<form class="rl-validation-example" data-rl-check-form><label class="rl-label">Catalog SKU<input class="rl-input" name="sku" required pattern="[A-Z]{2}-[0-9]{4}" placeholder="RL-2040"></label><small>Use two uppercase letters, a hyphen and four digits.</small><button class="rl-button" type="submit">Check SKU</button><output role="status"></output></form>`,
        "This checks the format locally. Use the inventory form to enforce a unique SKU on the server.",
      ),
    ],
  },
  {
    name: "Display utilities",
    items: [
      example(
        "aura",
        "Aura",
        "Frame an interactive surface with a subtle moving highlight.",
        `<a class="rl-aura" href="/components/carousel"><span>Studio lighting</span><strong>Explore the collection ↗</strong></a>`,
      ),
      example(
        "countdown",
        "Countdown",
        "Show the time remaining until the next daily shipping cutoff.",
        `<div class="rl-countdown" data-rl-cutoff-hour="16"><span>Next shipping cutoff · 16:00 UTC</span><time>16:00 UTC</time></div>`,
        "The display follows the next daily cutoff in UTC. Tick updates stay out of live announcements.",
      ),
      example(
        "indicator",
        "Indicator",
        "Anchor a quantity to an icon or action.",
        `<a class="rl-indicator-anchor rl-button" href="/layouts/dashboard?view=inventory" aria-label="Inventory, 3 updates">Inventory<span class="rl-corner-count" aria-hidden="true">3</span></a>`,
      ),
      example(
        "mask",
        "Mask",
        "Crop an image while keeping its alternative text.",
        `<figure class="rl-mask-sample">${lamp}<figcaption>Soft ivory</figcaption></figure>`,
      ),
      example(
        "stack",
        "Stack",
        "Layer related previews while keeping the current item legible.",
        `<figure class="rl-deck" aria-label="Studio lighting collection">${lamp}<figcaption>Spring lighting</figcaption></figure>`,
      ),
      example(
        "status",
        "Status",
        "Show system status with a label and a visual marker.",
        `<span class="rl-status-marker"><i aria-hidden="true"></i>All systems operational</span>`,
      ),
      example(
        "swap",
        "Swap",
        "Switch between two labels or icons on a native control.",
        `<label class="rl-swap"><input type="checkbox" aria-label="Pin item"><span aria-hidden="true">☆ Pin</span><span aria-hidden="true">★ Pinned</span></label>`,
      ),
      example(
        "text-rotate",
        "Text Rotate",
        "Rotate through short messages with explicit playback controls.",
        `<div class="rl-text-cycle" data-rl-text-cycle><span>Studio finishes</span><strong data-cycle-item>Soft ivory</strong><strong data-cycle-item hidden>Warm sand</strong><strong data-cycle-item hidden>Graphite</strong><button type="button" class="rl-button rl-button-sm" data-cycle-next>Next finish</button><button type="button" class="rl-button rl-button-sm" data-cycle-play aria-pressed="false">Auto rotate</button></div>`,
      ),
    ],
  },
  {
    name: "Mockups",
    items: [
      example(
        "browser-mockup",
        "Browser Mockup",
        "Present a site preview inside a compact browser frame.",
        `<figure class="rl-device rl-device-browser"><figcaption>studio.local / collection</figcaption>${lamp}</figure>`,
      ),
      example(
        "phone-mockup",
        "Phone Mockup",
        "Frame a mobile product screen.",
        `<figure class="rl-device rl-device-phone">${lamp}<figcaption>Arc Task Lamp<br><small>Studio lighting</small></figcaption></figure>`,
      ),
      example(
        "window-mockup",
        "Window Mockup",
        "Place a desktop tool inside a labelled window.",
        `<figure class="rl-device rl-device-window"><figcaption>Studio inventory</figcaption><div><strong>Spring collection</strong><p>Lighting, objects and furniture.</p></div></figure>`,
      ),
      example(
        "code-mockup",
        "Code Mockup",
        "Present a terminal command and its output.",
        `<figure class="rl-device rl-device-terminal"><figcaption>Terminal</figcaption><pre><code>$ npm start\nMero UI is running locally.</code></pre></figure>`,
      ),
    ],
  },
];

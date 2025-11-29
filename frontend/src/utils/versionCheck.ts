/**
 * Version check utility to detect when a new version of the app is available.
 * This helps ensure users always see the latest version after deployment.
 */

// This will be replaced at build time with the actual build timestamp
const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || Date.now().toString();

/**
 * Check if a new version is available by comparing the current build version
 * with a version marker file that gets updated on each deployment.
 */
export async function checkForUpdates(): Promise<boolean> {
    try {
        // Fetch the version file with cache-busting query parameter
        const response = await fetch(`/version.txt?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
            },
        });

        if (!response.ok) {
            // If version file doesn't exist, assume we're up to date
            return false;
        }

        const serverVersion = await response.text();
        const currentVersion = BUILD_VERSION;

        // If versions don't match, a new version is available
        return serverVersion.trim() !== currentVersion.trim();
    } catch (error) {
        // Silently fail: don't interrupt user experience
        console.debug('[VersionCheck] Failed to check for updates:', error);
        return false;
    }
}

/**
 * Prompt user to reload the page when a new version is detected.
 * This will show a permanent notification banner until the user reloads.
 */
export function promptReload(): void {
    // Check if banner already exists to avoid duplicates
    const existingBanner = document.getElementById('version-update-banner');
    if (existingBanner) {
        return;
    }

    // Create a notification banner
    const banner = document.createElement('div');
    banner.id = 'version-update-banner';
    banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: linear-gradient(135deg, #3da1ff 0%, #7f53ff 100%);
    color: white;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    font-size: 14px;
    font-weight: 500;
  `;

    banner.innerHTML = `
    <span>✨ A new version is available! Please reload to get the latest updates.</span>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button id="reload-btn" style="
        background: white;
        color: #3da1ff;
        border: none;
        padding: 6px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: opacity 0.2s;
      " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Reload Now</button>
    </div>
  `;

    document.body.appendChild(banner);

    // Add event listener for reload button
    const reloadBtn = banner.querySelector('#reload-btn');
    reloadBtn?.addEventListener('click', () => {
        window.location.reload();
    });

    // Banner stays visible permanently until user reloads
    // No auto-dismiss or dismiss button
}

/**
 * Check for updates and show prompt if available
 */
async function checkAndPrompt(): Promise<void> {
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) {
        promptReload();
    }
}

/**
 * Initialise version checking: runs periodic checks for updates
 * @param onRouteChange Optional callback to check on route changes
 */
export function initVersionCheck(onRouteChange?: () => void): void {
    // Check immediately on load
    checkAndPrompt();

    // Check every 5 minutes
    setInterval(() => {
        checkAndPrompt();
    }, 5 * 60 * 1000);

    // If route change callback is provided, wrap it to also check for updates
    if (onRouteChange) {
        const originalCallback = onRouteChange;
        onRouteChange = () => {
            originalCallback();
            // Check for updates when route changes
            checkAndPrompt();
        };
    }
}

/**
 * Check for updates on route change: call this when navigating to a new page
 */
export function checkOnRouteChange(): void {
    checkAndPrompt();
}

const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || Date.now().toString();

export async function checkForUpdates(): Promise<boolean> {
    try {
        const response = await fetch(`/version.txt?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
            },
        });

        if (!response.ok) {
            return false;
        }

        const serverVersion = await response.text();
        const currentVersion = BUILD_VERSION;

        return serverVersion.trim() !== currentVersion.trim();
    } catch (error) {
        console.debug('[VersionCheck] Failed to check for updates:', error);
        return false;
    }
}

export function promptReload(): void {
    const existingBanner = document.getElementById('version-update-banner');
    if (existingBanner) {
        return;
    }

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

    const reloadBtn = banner.querySelector('#reload-btn');
    reloadBtn?.addEventListener('click', () => {
        window.location.reload();
    });
}

async function checkAndPrompt(): Promise<void> {
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) {
        promptReload();
    }
}

export function initVersionCheck(onRouteChange?: () => void): void {
    checkAndPrompt();

    setInterval(() => {
        checkAndPrompt();
    }, 5 * 60 * 1000);

    if (onRouteChange) {
        const originalCallback = onRouteChange;
        onRouteChange = () => {
            originalCallback();
            checkAndPrompt();
        };
    }
}

export function checkOnRouteChange(): void {
    checkAndPrompt();
}

import {config as config12} from './versions/12.x';
import {config as config13} from './versions/13.x';

/**
 * Manages Foundry VTT version-specific configurations
 */
class FoundryVersionManagerClass {
    private initialized = false;

    /**
     * Configure Foundry-specific features based on version
     * @param foundryVersion The current Foundry version
     */
    configure(foundryVersion: string): void {
        if (this.initialized) {
            console.warn('[MobiVTT] FoundryVersionManager already initialized');
            return;
        }

        if (foundry.utils.isNewerVersion(foundryVersion, "13.0")) {
            config13();
            console.log(`[MobiVTT] Configured for Foundry VTT 13.x`);
        } else {
            config12();
            console.log(`[MobiVTT] Configured for Foundry VTT 12.x`);
        }

        this.initialized = true;
    }

    /**
     * Check if manager has been initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}

export const FoundryVersionManager = new FoundryVersionManagerClass();

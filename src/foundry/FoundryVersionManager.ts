import {config as config12} from './versions/12.x';
import {config as config13} from './versions/13.x';
import {config as config14} from './versions/14.x';

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

        const foundryMajor = parseInt(foundryVersion.split('.')[0], 10);
        if (foundryMajor >= 14) {
            config14();
            console.log(`[MobiVTT] Configured for Foundry VTT 14.x`);
        } else if (foundryMajor >= 13) {
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

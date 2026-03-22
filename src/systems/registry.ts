import {SystemAdapter} from './base/SystemAdapter';

/**
 * Registry for managing game system adapters
 */
class SystemRegistryClass {
    private adapters: Map<string, SystemAdapter> = new Map();

    /**
     * Register a system adapter
     * @param adapter The adapter to register
     */
    register(adapter: SystemAdapter): void {
        this.adapters.set(adapter.systemId, adapter);
        console.log(`[MobiVTT] Registered adapter for system: ${adapter.systemId}`);
    }

    /**
     * Get an adapter for a specific system
     * @param systemId The system ID
     */
    getAdapter(systemId: string): SystemAdapter | undefined {
        return this.adapters.get(systemId);
    }

    /**
     * Check if a system is supported
     * @param systemId The system ID to check
     */
    isSupported(systemId: string): boolean {
        return this.adapters.has(systemId);
    }

    /**
     * Get all registered system IDs
     */
    getSupportedSystems(): string[] {
        return Array.from(this.adapters.keys());
    }
}

export const SystemRegistry = new SystemRegistryClass();

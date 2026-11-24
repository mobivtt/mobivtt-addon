import {getUrl} from './settings';
import type {Dnd5eCharacter} from './types/character';
import {compressJsonToBase64} from './lib/compress';
import {metricsCollector} from './metrics';

// Mirrored from mobivtt/src/types/ws-protocol.ts (cross-submodule imports break Vite)

interface EditUpdate {
    id: string;
    path: string;
    type: 'absolute';
    value?: unknown;
}

// Website is the RNG authority: these are the exact die values the player saw.
interface RollPayload {
    dice: { type: string; value: number }[];
    total: number;
    modifier: number;
    flavor?: string;
}

type WsMessage =
    | { type: 'character_update'; characterId: string; data: string /* gzip+base64 JSON */ }
    | { type: 'character_delete'; characterId: string }
    | { type: 'portrait_update'; characterId: string; portrait: string | null }
    | { type: 'edit_request'; characterId: string; updates: EditUpdate[] }
    | { type: 'roll_request'; characterId: string; roll: RollPayload }
    | { type: 'edit_ack'; updateIds: string[]; status: 'applied' | 'failed' }
    | { type: 'session_metadata'; foundryVersion: string; systemVersion: string; moduleVersion: string; activeModules?: string[]; systemId?: string }
    | { type: 'session_info'; characters: unknown[]; connectedClients: number; foundryConnected: boolean; planType?: string }
    | { type: 'session_offline' }
    | { type: 'character_reject'; characterId: string; message: string }
    | { type: 'subscription_changed'; planType: string; characterLimit: number; status: string }
    | { type: 'error'; message: string };

class MobiVTTWebSocket {
    private ws: WebSocket | null = null;
    private accessCode = '';
    private worldId = '';
    private reconnectDelay = 1000;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private _connected = false;
    private editRequestCallback: ((msg: { characterId: string; updates: EditUpdate[] }) => void) | null = null;
    private rollRequestCallback: ((msg: { characterId: string; roll: RollPayload }) => void) | null = null;
    private connectCallback: (() => void) | null = null;
    private rejected = false;
    private portraitSources = new Map<string, string | null>();
    private reconnectAttemptCount = 0;

    get connected(): boolean { return this._connected; }

    connect(accessCode: string, worldId: string): void {
        this.accessCode = accessCode;
        this.worldId = worldId;
        this.rejected = false;
        this.doConnect();
    }

     private doConnect(): void {
         if (this.rejected) return;

         this.reconnectAttemptCount++;
         
         const baseUrl = getUrl('').replace(/^http(s?):/, 'ws$1:').replace(/\/$/, '');
         const wsUrl = `${baseUrl}/api/ws/${encodeURIComponent(this.accessCode)}?role=foundry&worldId=${encodeURIComponent(this.worldId)}`;
         console.log(`[MobiVTT] Connecting WebSocket to ${baseUrl}/api/ws/[redacted]`);

         metricsCollector.track(
             'websocket_reconnect_attempted',
             'health',
             'addon',
             {
                 foundry_major: game.version?.split('.')[0],
                 system: game.world.system,
                 metadata: { attempt: this.reconnectAttemptCount },
             }
         );

         try {
             this.ws = new WebSocket(wsUrl);
         } catch (error) {
             metricsCollector.track(
                 'websocket_reconnect_failed',
                 'health',
                 'addon',
                 {
                     foundry_major: game.version?.split('.')[0],
                     system: game.world.system,
                     metadata: { 
                         attempt: this.reconnectAttemptCount,
                         error_type: error instanceof Error ? error.name : 'unknown',
                     },
                 }
             );
             this.scheduleReconnect();
             return;
         }

         this.ws.onopen = () => {
             this._connected = true;
             this.reconnectDelay = 1000;
             this.reconnectAttemptCount = 0;
             this.portraitSources.clear();
             this.startHeartbeat();
            console.log('[MobiVTT] WebSocket connected');
            this.sendMetadata();
            this.connectCallback?.();
        };

        this.ws.onclose = (event) => {
            this._connected = false;
            this.portraitSources.clear();
            this.stopHeartbeat();
            if (!this.rejected) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (event) => {
            const errorEvent = event as ErrorEvent;
            if (errorEvent.message?.includes('409') || errorEvent.message?.includes('already active')) {
                this.rejected = true;
                ui.notifications?.error(
                    'Another MobiVTT session is already active for this access code. Close the other world first.',
                    { permanent: true }
                );
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string) as WsMessage;
                if (msg.type === 'edit_request' && this.editRequestCallback) {
                    this.editRequestCallback(msg);
                } else if (msg.type === 'roll_request' && this.rollRequestCallback) {
                    this.rollRequestCallback(msg);
                } else if (msg.type === 'character_reject') {
                    const actor = game.actors?.get(msg.characterId);
                    if (actor) actor.update({ 'flags.mobivtt.sync': false });
                    ui.notifications?.warn(`[MobiVTT] ${msg.message}`);
                } else if (msg.type === 'subscription_changed') {
                    const mobivtt = (globalThis as any).mobivtt;
                    if (mobivtt) {
                        mobivtt.plan = {
                            plan_type: msg.planType,
                            character_limit: msg.characterLimit,
                        };
                    }
                    if (msg.status === 'canceled') {
                        ui.notifications?.warn('[MobiVTT] Your subscription has been canceled.');
                    } else {
                        ui.notifications?.info(`[MobiVTT] Subscription updated: ${msg.planType} plan.`);
                    }
                } else if (msg.type === 'error') {
                    ui.notifications?.warn(`[MobiVTT] ${msg.message}`);
                }
            } catch { /* ignore malformed messages */ }
        };
    }

    private sendMetadata(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const activeModules = Array.from(game.modules?.values() ?? [])
            .filter(m => m.active && m.id !== 'mobivtt')
            .map(m => `${m.id}:${m.version}`);
        const msg: WsMessage = {
            type: 'session_metadata',
            foundryVersion: game.version ?? 'unknown',
            systemVersion: game.system?.version ?? 'unknown',
            moduleVersion: game.modules?.get('mobivtt')?.version ?? 'unknown',
            activeModules,
            systemId: game.system?.id ?? 'unknown',
        };
        this.ws.send(JSON.stringify(msg));
    }

    async sendCharacterUpdate(characterId: string, data: Dnd5eCharacter): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const compressed = await compressJsonToBase64(data);
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg: WsMessage = { type: 'character_update', characterId, data: compressed };
        this.ws.send(JSON.stringify(msg));
    }

    sendCharacterDelete(characterId: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg: WsMessage = { type: 'character_delete', characterId };
        this.ws.send(JSON.stringify(msg));
        this.portraitSources.delete(characterId);
    }

    needsPortraitUpdate(characterId: string, currentSource: string | null): boolean {
        if (!this.portraitSources.has(characterId)) return true;
        return this.portraitSources.get(characterId) !== currentSource;
    }

    sendPortraitUpdate(characterId: string, portrait: string | null, sourcePath: string | null): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg: WsMessage = { type: 'portrait_update', characterId, portrait };
        this.ws.send(JSON.stringify(msg));
        this.portraitSources.set(characterId, sourcePath);
    }

    sendEditAck(updateIds: string[], status: 'applied' | 'failed'): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg: WsMessage = { type: 'edit_ack', updateIds, status };
        this.ws.send(JSON.stringify(msg));
    }

    onEditRequest(cb: (msg: { characterId: string; updates: EditUpdate[] }) => void): void {
        this.editRequestCallback = cb;
    }

    onRollRequest(cb: (msg: { characterId: string; roll: RollPayload }) => void): void {
        this.rollRequestCallback = cb;
    }

    onConnect(cb: () => void): void {
        this.connectCallback = cb;
    }

    disconnect(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.stopHeartbeat();
        this.ws?.close(1000, 'Module shutdown');
        this._connected = false;
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
            console.log(`[MobiVTT] Reconnecting WebSocket (delay: ${this.reconnectDelay}ms)...`);
            this.doConnect();
        }, this.reconnectDelay);
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
        }, 30000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    }
}

export const mobiWs = new MobiVTTWebSocket();

/**
 * Addon Metrics Collection
 * 
 * Vanilla TypeScript MetricsCollector for addon lifecycle and sync events.
 * No dependencies. Fire-and-forget to POST /api/metrics endpoint.
 * 
 * Events tracked:
 * - addon_initialized: Module ready with Foundry/system versions
 * - sync_initiated: User enables sync for character
 * - actor_serialized: Character data extracted
 * - websocket_connected: WS connection established to cloud
 * - sync_complete: Character pushed to cloud
 * - access_code_validated: License validated successfully
 * - edit_request_received: Mobile edit arrived from cloud
 * - edit_request_applied: Edit applied to Foundry actor
 * - edit_request_rejected: Edit failed validation
 */

interface MetricEvent {
  event: string;
  category: string;
  component: string;
  plan?: string;
  system?: string;
  foundry_major?: string;
  access_code?: string;
  world_id?: string;
  character_id?: string;
  metadata?: Record<string, string | number | boolean>;
}

interface MetricsRequest {
  events: MetricEvent[];
}

export class MetricsCollector {
  private buffer: MetricEvent[] = [];
  private readonly maxBufferSize = 50;
  private readonly flushIntervalMs = 15000; // 15 seconds
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly endpoint: string;
  private enabled = true;
  private accessCode = '';

  /**
   * Honours the 'send_analytics' world setting. Disabling drops anything
   * already buffered, so unchecking the box does not leak a final batch.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.buffer = [];
  }

  /**
   * The access code identifies the installation, not the event, so it is held
   * here and stamped on at flush time. Most track() call sites do not pass one,
   * and the server rejects a batch it cannot attribute.
   */
  setAccessCode(accessCode: string): void {
    this.accessCode = accessCode;
  }

  constructor(endpoint: string = '/api/metrics') {
    this.endpoint = endpoint;
    this.startFlushTimer();
  }

  /**
   * Track a metric event
   * Adds event to buffer, evicts oldest if buffer exceeds 50 events
   * 
   * @param event - Event name (e.g., "addon_initialized")
   * @param category - infrastructure|health|business
   * @param component - addon
   * @param metadata - Optional additional fields (plan, system, foundry_major, etc.)
   */
  track(
    event: string,
    category: string,
    component: string,
    metadata?: Partial<Omit<MetricEvent, 'event' | 'category' | 'component'>>
  ): void {
    if (!this.enabled) return;
    try {
      const metricEvent: MetricEvent = {
        event,
        category,
        component,
        ...metadata,
      };

      this.buffer.push(metricEvent);

      // FIFO eviction: Remove oldest event if buffer exceeds max size
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift(); // Remove first (oldest) event
      }
    } catch (error) {
      // Fire-and-forget: Silently handle errors, never throw
      console.error('[MetricsCollector] Error tracking event:', error);
    }
  }

  /**
   * Flush buffered events to endpoint
   * Clears buffer on successful POST
   * 
   * Fire-and-forget: Drops events on flush failure
   */
  async flush(): Promise<void> {
    try {
      // Nothing to flush
      if (this.buffer.length === 0) {
        return;
      }

      const eventsToSend = [...this.buffer];
      const requestBody: MetricsRequest = {
        events: this.accessCode
          ? eventsToSend.map((e) => ({ ...e, access_code: e.access_code ?? this.accessCode }))
          : eventsToSend,
      };

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.warn('[MetricsCollector] Flush failed:', response.status);
        return;
      }

      // Clear buffer on successful flush
      this.buffer = [];
    } catch (error) {
      // Fire-and-forget: Silently ignore network/parsing errors
      console.error('[MetricsCollector] Flush error:', error);
    }
  }

  /**
   * Start auto-flush timer (15 seconds)
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Manually flush and stop timer
   */
  destroy(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

/**
 * Global singleton instance
 */
export const metricsCollector = new MetricsCollector(`${__MOBIVTT_WEB__}/api/metrics`);

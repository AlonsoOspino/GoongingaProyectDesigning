import OBSWebSocket from 'obs-websocket-js';

export interface OBSConfig {
  host: string;
  port: number;
  password: string;
}

class OBSWebSocketManager {
  private obs: OBSWebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  async connect(config: OBSConfig): Promise<void> {
    if (this.isConnected) {
      console.log('[v0] OBS WebSocket already connected');
      return;
    }

    try {
      this.obs = new OBSWebSocket();

      await this.obs.connect(`ws://${config.host}:${config.port}`, config.password);

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[v0] OBS WebSocket connected successfully');
    } catch (error) {
      console.error('[v0] Failed to connect to OBS WebSocket:', error);
      this.handleConnectionError();
    }
  }

  async disconnect(): Promise<void> {
    if (this.obs) {
      try {
        await this.obs.disconnect();
        this.isConnected = false;
        console.log('[v0] OBS WebSocket disconnected');
      } catch (error) {
        console.error('[v0] Error disconnecting from OBS:', error);
      }
    }
  }

  async updateTextSource(sourceName: string, text: string): Promise<boolean> {
    if (!this.isConnected || !this.obs) {
      console.warn('[v0] OBS WebSocket not connected, cannot update text source');
      return false;
    }

    try {
      await this.obs.call('SetSourceFilterSettings', {
        sourceName,
        filterName: 'Text',
        filterSettings: {
          text,
        },
      });

      console.log(`[v0] Updated OBS text source "${sourceName}" to "${text}"`);
      return true;
    } catch (error) {
      // Try alternative method if the first one fails
      try {
        await this.obs.call('SetInputSettings', {
          inputName: sourceName,
          inputSettings: {
            text,
          },
        });
        console.log(`[v0] Updated OBS input source "${sourceName}" to "${text}"`);
        return true;
      } catch (secondError) {
        console.error(`[v0] Failed to update text source "${sourceName}":`, secondError);
        return false;
      }
    }
  }

  private handleConnectionError(): void {
    this.isConnected = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `[v0] Scheduling OBS WebSocket reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
      );

      setTimeout(() => {
        // Could implement auto-reconnect here if needed
      }, this.reconnectDelay);
    } else {
      console.error('[v0] Max OBS WebSocket reconnection attempts reached');
    }
  }

  isConnectedToOBS(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const obsManager = new OBSWebSocketManager();

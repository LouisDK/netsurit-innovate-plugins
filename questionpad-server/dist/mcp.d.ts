import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionStore } from './store.js';
export declare function createMcpServer(store: SessionStore, baseUrl: string): McpServer;

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import {createMcpServer} from "./mcp.js";

// Environment variables
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Start HTTP server
async function main() {
    console.error("Starting Documentation MCP Server...");
    
    const app = express();

    // Enable CORS for all origins (configure ass needed for production)
    app.use(cors());

    // Parse JSON bodies
    app.use(express.json());

    // Health check endpoint
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "documentation-mcp-server" });
    });

    // Create server and transport
    const server = createMcpServer();
    
    // Use stateless mode to support multiple clients
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
    });

    // Connect the server to the transport
    await server.connect(transport);

    // MCP endpoint - handles both GET (SSE) and POST (JSON-RPC) requests
    app.all("/mcp", async (req, res) => {
        await transport.handleRequest(req, res, req.body);
    });

    app.listen(PORT, HOST, () => {
        console.error(`Documentation MCP Server running on http://${HOST}:${PORT}`);
        console.error(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
        console.error(`Health check: http://${HOST}:${PORT}/health`);
        console.error(`Mode: HTTP (stateless, multiple clients supported)`);
    });
}

// Start the server
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});

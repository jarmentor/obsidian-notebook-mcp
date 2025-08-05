declare class AINotesearcher {
    private qdrantClient;
    private vectorProcessor;
    private fileWatcher;
    private mcpServer?;
    constructor();
    initialize(): Promise<void>;
    startMCPServer(): Promise<void>;
    shutdown(): Promise<void>;
}
export { AINotesearcher };
//# sourceMappingURL=index.d.ts.map
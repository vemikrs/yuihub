export class LiveContextService {
    private events: string[] = [];
    private maxEvents: number = 50;

    constructor() {}

    addEvent(type: string, path: string) {
        const timestamp = new Date().toISOString();
        const event = `[${timestamp}] ${type}: ${path}`;
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
    }

    getSnapshot(): string {
        if (this.events.length === 0) return "No recent file changes.";
        return "Recent File Changes:\n" + this.events.join('\n');
    }
}

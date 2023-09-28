import type * as Party from "partykit/server";

// connection.id -> serialized selection
type Selections = Map<string, string>;

type OutboundMessage = {
  type: "sync";
  selections: string[];
};

type InboundMessage = {
  type: "update";
  selection: string;
};

export default class SelectionsServer implements Party.Server {
  selections: Selections = new Map();

  constructor(public party: Party.Party) {}

  getSelections() {
    return Array.from(this.selections.values());
  }

  onConnect(connection: Party.Connection) {
    connection.send(
      JSON.stringify({ type: "sync", selections: this.getSelections() })
    );
  }

  onMessage(message: string, websocket: Party.Connection) {
    const msg = JSON.parse(message) as any;
    if (msg.type === "update") {
      this.selections.set(websocket.id, msg.selection);
      this.party.broadcast(
        JSON.stringify({ type: "sync", selections: this.getSelections() }),
        [websocket.id]
      );
    } else if (msg.type === "remove") {
      this.selections.delete(websocket.id);
      this.party.broadcast(
        JSON.stringify({ type: "sync", selections: this.getSelections() }),
        [websocket.id]
      );
    }
  }

  onClose(connection: Party.Connection) {
    this.selections.delete(connection.id);
    this.party.broadcast(
      JSON.stringify({ type: "sync", selections: this.getSelections() })
    );
  }
}

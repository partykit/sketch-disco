import type {
  PartyKitServer,
  Party,
  Connection,
  Request,
} from "partykit/server";

/* hyperspace.ts
 * Room ID corresponds to hashed URL.
 * - tracks number of connections and lets all subscribed parties know
 * - re-broadcasts 'exit' messages
 */

// The client lets us know what hyperlinks are on this page
// Sent as a client->party websocket message
type InitMessage = {
  type: "init";
  hashedUrls: string[];
};

// A party lets another party know that it is interested in connection changes
// Sent as a party->party HTTP request
type SubscribeMessage = {
  type: "subscribe";
  hashedUrl: string;
};

// A party lets another party know how many connections is has right now
// Sent as a party->party HTTP message, and also a party->client websocket message
type ConnectionsMessage = {
  type: "connections";
  hashedUrl: string;
  connections: number;
};

// A connection to this hashedUrl has made use of a hyperlink. Let all other
// connections know (but not other parties). Sent as a client->party->client websocket message
type ExitMessage = {
  type: "exit";
  domPath: string;
};

// All connections are informed of the number of connections to this hashedUrl
// Sent as a party->client websocket message
type HereMessage = {
  type: "here";
  connections: number;
};

export default class Connections implements PartyKitServer {
  readonly options = {
    hibernate: true,
  };

  constructor(public party: Party) {}

  connectionsCount() {
    // Length of this.party.getConnections() (a map)
    return Array.from(this.party.getConnections()).length;
  }

  async onMessage(message: string | ArrayBuffer, connection: Connection) {
    const msg = JSON.parse(message as string);
    if (msg.type === "init") {
      const { hashedUrls } = msg as InitMessage;
      for (const hashedUrl of hashedUrls) {
        await this.subscribe(hashedUrl, connection);
      }
    } else if (msg.type === "exit") {
      // Let all other connections know (but not other parties)
      this.party.broadcast(JSON.stringify(msg as ExitMessage), [connection.id]);
    }
  }

  async onConnect(connection: Connection) {
    // The number of connections has changed, so let all subscribers know
    await this.publish();
  }

  async onClose(connection: Connection) {
    // The number of connections has changed, so let all subscribers know
    await this.publish();
  }

  async subscribe(hashedUrl: string, connection: Connection) {
    const response = await this.party.context.parties.hyperspace
      .get(hashedUrl)
      .fetch({
        method: "POST",
        body: JSON.stringify({
          type: "subscribe",
          hashedUrl: this.party.id,
        }),
      });
    // The response might be a connections message, if the connection count is > 0
    const msg = (await response.json()) as any;
    if (msg.type === "connections") {
      // Let the current connection know
      connection.send(JSON.stringify(msg as ConnectionsMessage));
    }
  }

  async publish() {
    const connections = this.connectionsCount();

    // Let all connections to this page know how many connections there are
    this.party.broadcast(
      JSON.stringify({
        type: "here",
        connections: connections,
      } as HereMessage),
      []
    );

    // Let all subscribers know how many connections there are, too
    const subscribers: Map<string, string> = await this.party.storage.list();

    // Prepare variables for the loop
    const now = new Date();
    const msg = {
      type: "connections",
      hashedUrl: this.party.id,
      connections: connections,
    };

    for (const [storageKey, isoDate] of subscribers.entries()) {
      if (!storageKey.startsWith("hashedUrl-")) {
        // Skip non-subscriber keys
        continue;
      }
      const hashedUrl = storageKey.slice("hashedUrl-".length);
      if (now.getTime() - new Date(isoDate).getTime() > 24 * 60 * 60 * 1000) {
        // If the subscription is older than 24 hours, expire it
        await this.party.storage.delete(hashedUrl);
      } else {
        await this.party.context.parties.hyperspace.get(hashedUrl).fetch({
          method: "POST",
          body: JSON.stringify(msg),
        });
      }
    }
  }

  async onRequest(req: Request, party: Party) {
    if (req.method === "GET") {
      // Return debug information
      // In subscribers, only include keys that start with "hashedUrl-"
      const storage: Map<string, unknown> = await this.party.storage.list();
      const subscribers = new Map(
        [...storage.entries()].filter(([key]) => key.startsWith("hashedUrl-"))
      ) as Map<string, string>;
      return new Response(
        JSON.stringify(
          {
            subscribers: serializable(subscribers),
            connections: this.connectionsCount(),
            hashedUrl: this.party.id,
          },
          null,
          2
        )
      );
    } else if (req.method === "POST") {
      const msg = (await req.json()) as any;
      if (msg.type === "subscribe") {
        const { hashedUrl } = msg as SubscribeMessage;
        // Store this subscriber
        // Subscribers are all stored as separate keys in room storage,
        // together with the date of subscription. We do this because we don't want
        // subscriptions to live forever: they should expire after 24 hours
        await this.party.storage.put(
          `hashedUrl-${hashedUrl}`,
          new Date().toISOString()
        );
        // Respond to the the new subscriber with how many connections there are currently,
        // if over zero (to reduce noise)
        const connections = this.connectionsCount();
        if (connections > 0) {
          return new Response(
            JSON.stringify({
              type: "connections",
              hashedUrl: this.party.id,
              connections: this.connectionsCount(),
            } as ConnectionsMessage)
          );
        } else {
          // type: "success" is a null message that the requester ignores
          return new Response(JSON.stringify({ type: "success" }));
        }
      } else if (msg.type === "connections") {
        // We've been sent a connections message from a party we've previously subscribed to
        // It's an update! Let all connections to this room know
        this.party.broadcast(JSON.stringify(msg), []);
        return new Response(JSON.stringify({ type: "success" }));
      } else {
        return new Response("invalid message type", { status: 400 });
      }
    }

    return new Response("Method not implemented", { status: 501 });
  }
}

// A function that converts any value to a JSON serializable value. It calls itself recursively
// Strings, numbers, booleans, and dates are passed through.
// Arrays looked at element by element, recursively.
// Maps and Sets are converted to arrays, and looked at element by element, recursively.
function serializable(value: any): any {
  if (typeof value === "string") {
    return value;
  } else if (typeof value === "number") {
    return value;
  } else if (typeof value === "boolean") {
    return value;
  } else if (value instanceof Date) {
    return value;
  } else if (Array.isArray(value)) {
    return value.map((v) => serializable(v));
  } else if (value instanceof Map) {
    const obj = {};
    Array.from(value.entries()).map(([k, v]) => {
      obj[serializable(k)] = serializable(v);
    });
    return obj;
  } else if (value instanceof Set) {
    return Array.from(value).map((v) => serializable(v));
  } else if (typeof value === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = serializable(v);
    }
    return obj;
  } else {
    return null;
  }
}

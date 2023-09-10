import type {
  PartyKitServer,
  PartyKitConnection,
  PartyKitRoom,
  PartyRequest,
} from "partykit/server";

/* tracker
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

  constructor(public party: PartyKitRoom) {}

  connectionsCount() {
    return Array.from(this.party.connections).length;
  }

  async onMessage(
    message: string | ArrayBuffer,
    connection: PartyKitConnection
  ) {
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

  async onConnect(connection: PartyKitConnection) {
    // The number of connections has changed, so let all subscribers know
    await this.publish();
  }

  async onDisconnect(connection: PartyKitConnection) {
    // The number of connections has changed, so let all subscribers know
    await this.publish();
  }

  async subscribe(hashedUrl: string, connection: PartyKitConnection) {
    const response = await this.party.parties.tracker.get(hashedUrl).fetch({
      method: "POST",
      body: JSON.stringify({
        type: "subscribe",
        hashedUrl: this.party.id,
      }),
    });
    // The response is probably a connections message
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
    const subscriptions = (await this.party.storage.get(
      "subscriptions"
    )) as Set<string>;
    if (!subscriptions) return;
    const msg = {
      type: "connections",
      hashedUrl: this.party.id,
      connections: connections,
    };
    for (const hashedUrl of subscriptions) {
      await this.party.parties.tracker.get(hashedUrl).fetch({
        method: "POST",
        body: JSON.stringify(msg),
      });
    }
  }

  async onRequest(req: PartyRequest, party: PartyKitRoom) {
    if (req.method === "POST") {
      const msg = (await req.json()) as any;
      if (msg.type === "subscribe") {
        const { hashedUrl } = msg as SubscribeMessage;
        // Register this in subscriptions
        const subscriptions =
          ((await this.party.storage.get("subscriptions")) as Set<string>) ||
          new Set<string>();
        subscriptions.add(hashedUrl);
        await this.party.storage.put("subscriptions", subscriptions);
        // Respond to the the new subscriber with how many connections there are currently
        return new Response(
          JSON.stringify({
            type: "connections",
            hashedUrl: this.party.id,
            connections: this.connectionsCount(),
          } as ConnectionsMessage)
        );
      } else if (msg.type === "connections") {
        // We've been sent a connections message from a party we've previously subscribed to
        // It's an update! Let all connections to this room know
        this.party.broadcast(JSON.stringify(msg), []);
        return new Response("ok");
      } else {
        return new Response("invalid message type", { status: 400 });
      }
    }

    return new Response("Method not implemented", { status: 501 });
  }
}

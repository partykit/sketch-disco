import {
  PartyKitConnection,
  PartyKitServer,
  PartyStorage,
} from "partykit/server";
import {
  type RoomConnections,
  type UpdateMessage,
  SINGLETON_ROOM_ID,
} from "./room-types";

/*
 * - we run a singular room: announcer. All clients connect to this room
 * - room.ts sends a POST to announcer every time any room's connection count changes
 * - the client sends a subscribe message with a list of roomIds it is interested in
 * - whenever room counts change, we send an update message to all subscribers
 */

// Subscriptions is a bidirectional mapping of websocket.id -> hashedUrls
// A websocket.id sets a list of hashedUrls it is interested in. Whenever
// one of those hashedUrls changed status, we send an update to all subscribers.
// An instance of Subscriptions wraps two maps that are held in sync in room storage.
class Subscriptions {
  public wsToHashedUrls: Map<string, Set<string>>;
  private hashedUrlToWs: Map<string, Set<string>>;
  private storage: PartyStorage;

  constructor(storage: PartyStorage) {
    this.storage = storage;
    this.wsToHashedUrls = new Map();
    this.hashedUrlToWs = new Map();
  }

  static async load(room: { storage: PartyStorage }) {
    const instance = new Subscriptions(room.storage);
    const wsToHashedUrls = ((await room.storage.get("wsToHashedUrls")) ||
      []) as Map<string, Set<string>>;
    const hashedUrlToWs = ((await room.storage.get("hashedUrlToWs")) ||
      []) as Map<string, Set<string>>;
    instance.wsToHashedUrls = new Map(wsToHashedUrls);
    instance.hashedUrlToWs = new Map(hashedUrlToWs);
    return instance;
  }

  private async persist() {
    await this.storage.put("wsToHashedUrls", this.wsToHashedUrls);
    await this.storage.put("hashedUrlToWs", this.hashedUrlToWs);
  }

  async set(ws: string, hashedUrls: Set<string> | null) {
    // If null is passed, remove A and its associations
    if (hashedUrls === null) {
      if (this.wsToHashedUrls.has(ws)) {
        for (const hashedUrl of this.wsToHashedUrls.get(ws)!) {
          this.hashedUrlToWs.get(hashedUrl)!.delete(ws);
        }
        this.wsToHashedUrls.delete(ws);
      }
    } else {
      // Remove ws's old associations
      if (this.wsToHashedUrls.has(ws)) {
        for (const hashedUrl of this.wsToHashedUrls.get(ws)!) {
          this.hashedUrlToWs.get(hashedUrl)!.delete(ws);
          if (this.hashedUrlToWs.get(hashedUrl)!.size === 0) {
            this.hashedUrlToWs.delete(hashedUrl);
          }
        }
      }

      // Add ws's new associations
      this.wsToHashedUrls.set(ws, hashedUrls);
      for (const hashedUrl of hashedUrls) {
        if (!this.hashedUrlToWs.has(hashedUrl)) {
          this.hashedUrlToWs.set(hashedUrl, new Set());
        }
        this.hashedUrlToWs.get(hashedUrl)!.add(ws);
      }
    }

    await this.persist();
  }

  lookup(hashedUrl: string) {
    return this.hashedUrlToWs.get(hashedUrl) || new Set();
  }
}

export default {
  async onMessage(message, websocket, room) {
    const msg = JSON.parse(message as string);
    if (msg.type === "subscribe") {
      // This websocket wants to hear about connection count changes for all of these rooms
      // Stash it on the websocket attachment so that it goes away when the websocket closes
      const subscriptions = await Subscriptions.load(room);
      await subscriptions.set(websocket.id, new Set(msg.roomIds));
      // Send the current connection counts for all of these rooms
      const rc = ((await room.storage.get("roomConnections")) ||
        []) as RoomConnections;
      const subscribedRc = Object.fromEntries(
        Object.entries(rc).filter(([roomId, _]) => msg.roomIds.includes(roomId))
      ) as RoomConnections;
      //console.log("sending initial update", subscribedRc);
      websocket.send(
        JSON.stringify(<UpdateMessage>{
          type: "update",
          subtype: "initial",
          updates: subscribedRc,
        })
      );
    }
  },

  async onClose(websocket, room) {
    // Remove this websocket from all subscriptions
    const subscriptions = await Subscriptions.load(room);
    await subscriptions.set(websocket.id, null);

    // Take the opportunity to remove any other websockets that are still hanging around
    const wsIds = Array.from(room.getConnections()).map((ws) => ws.id);
    const wsIdsToRemove = wsIds.filter(
      (wsId) => !subscriptions.wsToHashedUrls.has(wsId)
    );
    for (const wsId of wsIdsToRemove) {
      //console.log("removing stale websocket", wsId);
      await subscriptions.set(wsId, null);
    }
  },

  async onRequest(request, room) {
    if (room.id !== SINGLETON_ROOM_ID)
      return new Response("Not found", { status: 404 });

    if (request.method === "POST") {
      const { roomId, connections } = await request.json();
      // Store the connection count for this room
      const rc = ((await room.storage.get("roomConnections")) ||
        {}) as RoomConnections;
      if (connections === 0) {
        delete rc[roomId];
      } else {
        rc[roomId] = connections;
      }
      await room.storage.put("roomConnections", rc);
      // Send the update to all subscribers
      const updateMsg = <UpdateMessage>{
        type: "update",
        subtype: "incremental",
        updates: <RoomConnections>{ [roomId]: connections },
      };
      //console.log("checking for subscriptions to roomId", roomId);
      const subscriptions = await Subscriptions.load(room);
      const subscribers = subscriptions.lookup(roomId);
      Array.from(room.getConnections()).map((subscriberWebsocket) => {
        if (subscribers.has(subscriberWebsocket.id)) {
          //console.log("sending update to", subscriberWebsocket.id);
          subscriberWebsocket.send(JSON.stringify(updateMsg));
        }
      });
      return new Response("OK");
    }

    // This is for debugging
    if (request.method === "GET") {
      const entries = await room.storage.list();
      // Make an object with all the keys and their values
      const obj = {};
      for (const entry of entries) {
        obj[entry[0]] = serializable(entry[1]);
      }
      return new Response(JSON.stringify(obj, null, 2));
    }

    return new Response("Unknown method", { status: 400 });
  },
} satisfies PartyKitServer;

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
    return Array.from(value.entries()).map(([k, v]) => [
      serializable(k),
      serializable(v),
    ]);
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

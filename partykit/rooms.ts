import { PartyKitServer } from "partykit/server";
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

export default {
  async onMessage(message, websocket, room) {
    const msg = JSON.parse(message as string);
    if (msg.type === "subscribe") {
      // This websocket wants to hear about connection count changes for all of these rooms
      // Stash it on the websocket attachment so that it goes away when the websocket closes
      websocket.serializeAttachment({
        ...websocket.deserializeAttachment(),
        subscriptions: msg.roomIds,
      });
      console.log(
        "websocket.id subscriptions [saving]",
        websocket.id,
        msg.roomIds
      );
      // Send the current connection counts for all of these rooms
      const rc = ((await room.storage.get("roomConnections")) ||
        {}) as RoomConnections;
      const subscribedRc = Object.fromEntries(
        Object.entries(rc).filter(([roomId, _]) => msg.roomIds.includes(roomId))
      );
      websocket.send(
        JSON.stringify(<UpdateMessage>{
          type: "update",
          updates: subscribedRc,
        })
      );
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
        updates: <RoomConnections>{ roomId, connections },
      };
      Array.from(room.connections).forEach(([_, subscriberWebsocket]) => {
        const attachment = subscriberWebsocket.deserializeAttachment();
        const subscriptions = attachment.subscriptions ?? [];
        console.log(
          "websocket.id subscriptions [loading]",
          subscriberWebsocket,
          subscriptions
        );
        if (subscriptions.includes(roomId)) {
          console.log("sending update to", subscriberWebsocket.id);
          subscriberWebsocket.send(JSON.stringify(updateMsg));
        }
      });
      return new Response("OK");
    }

    // This is for debugging
    if (request.method === "GET") {
      const rc = ((await room.storage.get("roomConnections")) ||
        {}) as RoomConnections;
      const subscriptions = Object.fromEntries(
        Array.from(room.connections).map(
          ([subscriberRoomId, subscriberWebsocket]) => {
            const roomSubscriptions =
              (subscriberWebsocket.deserializeAttachment().subscriptions ??
                []) as string[];
            return [subscriberRoomId, roomSubscriptions];
          }
        )
      );
      return new Response(
        JSON.stringify({ roomConnections: rc, subscriptions: subscriptions })
      );
    }

    return new Response("Unknown method", { status: 400 });
  },
} satisfies PartyKitServer;

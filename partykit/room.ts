import { PartyKitServer, PartyKitRoom } from "partykit/server";
import {
  type RoomConnections,
  type HereMessage,
  type ExitMessage,
  SINGLETON_ROOM_ID,
} from "./room-types";

/*
 * - each URL has its own room (id is hashedUrl)
 * - purpose 1: tracking connections. a POST to rooms.ts updates the connection count for the current room
 * - purpose 2: broadcasting exit events. This uses domPath, not hashedUrl
 */

function broadcastConnections(room: PartyKitRoom) {
  room.broadcast(
    JSON.stringify(<HereMessage>{
      type: "here",
      connections: room.connections.size,
    })
  );
}

async function updateConnections(room) {
  // Let rooms.ts know about the connection count for this room
  return await room.context.parties.rooms.get(SINGLETON_ROOM_ID).fetch({
    method: "POST",
    body: JSON.stringify({
      roomId: room.id,
      connections: room.connections.size,
    }),
  });
}

export default {
  async onConnect(websocket, room) {
    // The number of connections has changed, so let rooms.ts know
    await updateConnections(room);
    // Let everyone in the current room know
    broadcastConnections(room);
  },
  async onClose(websocket, room) {
    // The number of connections has changed, so let rooms.ts know
    await updateConnections(room);
    // Let everyone in the current room know
    broadcastConnections(room);
  },
  async onMessage(message, websocket, room) {
    const msg = JSON.parse(message as string);
    if (msg.type === "exit") {
      // Let everyone in the current room know. Don't exclude the current
      // websocket as they may have opened the link in a new tab
      room.broadcast(
        JSON.stringify(<ExitMessage>{ type: "exit", domPath: msg.domPath }),
        []
      );
      console.log("exit for room", room.id, msg.domPath);
    }
  },
  async onRequest(request, room) {
    // This is for debugging
    if (request.method === "GET") {
      return new Response(
        JSON.stringify(
          {
            roomId: room.id,
            connections: room.connections.size,
          },
          null,
          2
        )
      );
    }

    return new Response("Unknown method", { status: 400 });
  },
} satisfies PartyKitServer;

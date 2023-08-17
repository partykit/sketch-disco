export type SubscribeMessage = {
  type: "subscribe";
  roomIds: string[];
};

export type UpdateMessage = {
  type: "update";
  updates: RoomConnections;
};

export type HereMessage = {
  type: "here";
  connections: number;
};

export type ExitMessage = {
  type: "exit";
  domPath: string;
};

export type RoomConnections = Record<string, number>; // roomId -> connections

export const SINGLETON_ROOM_ID = "announcer";

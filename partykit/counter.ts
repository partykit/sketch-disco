import type * as Party from "partykit/server";

export type PageConnectionsSummary = Record<string, number>;

export type PageConnectionsUpdate = {
  action: "update";
  id: string;
  connectionCount: number;
};

export type PageConnectionsSubscribe = {
  action: "subscribe";
  subscriberId: string;
  subscribeToRoomIds: string[];
};

type PageConnectionsRequest = PageConnectionsUpdate | PageConnectionsSubscribe;

type PageState = {
  id: string;
  connectionCount: number;
  subscriberIds: string[];
};

const CLEANUP_ALARM_DELAY = 1000 * 60 * 60; // 1 hour

const json = (data: any) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

/**
 * Keeps track of currently active connections to all pages.
 * The Page party communicates with this party via HTTP requests
 **/
export default class CounterServer implements Party.Server {
  constructor(readonly party: Party.Party) {}

  options: Party.ServerOptions = {
    hibernate: true,
  };

  /** The page party communicates with this party via HTTP requests */
  async onRequest(req: Party.Request) {
    if (req.method === "POST") {
      const request = await req.json<PageConnectionsRequest>();
      if (request.action === "subscribe")
        return this.handleSubscribeRequest(request);
      if (request.action === "update")
        return this.handleConnectionCountUpdateRequest(request);
    }

    return new Response("Bad request", { status: 400 });
  }

  async onAlarm() {
    // let's do a little cleanup. if page currently doesn't have any listeners,
    // we can safely delete it, since it will get recreated when a new listener joins
    const allPages = await this.party.storage.list<PageState>();
    for (const [pageId, pageState] of allPages) {
      if (pageState.connectionCount === 0) {
        await this.party.storage.delete(pageId);
      }
    }

    // if there are pages we are still tracking, let's clean up again after the interval
    const remainingPages = await this.party.storage.list<PageState>();
    if (remainingPages.size > 0) {
      await this.party.storage.setAlarm(Date.now() + CLEANUP_ALARM_DELAY);
    }
  }

  /** Allow page party to subscribe updates to other pages' connection counts */
  async handleSubscribeRequest(request: PageConnectionsSubscribe) {
    // add subscribers to rooms
    const rooms = await Promise.all(
      request.subscribeToRoomIds.map((roomId) =>
        this.addSubscriber(roomId, request.subscriberId)
      )
    );

    // return the initial connection count for each subscribed room
    return json(
      rooms.reduce((acc, room) => {
        acc[room.id] = room.connectionCount;
        return acc;
      }, {} as PageConnectionsSummary)
    );
  }

  /** Allow page party to update its own connection count, and notify subscribers */
  async handleConnectionCountUpdateRequest(request: PageConnectionsUpdate) {
    // update the room state
    const roomState = await this.updateRoomState(request.id, (state) => ({
      ...state,
      connectionCount: request.connectionCount,
    }));

    const update = JSON.stringify({
      action: "update",
      id: roomState.id,
      connectionCount: roomState.connectionCount,
    } satisfies PageConnectionsUpdate);

    // notify all subscribers of the new connection count
    await Promise.all(
      roomState.subscriberIds.map((subscriberId) =>
        this.party.context.parties.page.get(subscriberId).fetch({
          method: "POST",
          body: update,
        })
      )
    );

    return json({ success: true });
  }

  /** Utility for getting (or creating) the state for a given page */
  async getRoomState(pageId: string) {
    const state = await this.party.storage.get<PageState>(pageId);
    return (
      state ?? {
        id: pageId,
        connectionCount: 0,
        subscriberIds: [],
      }
    );
  }

  /** Utility for updating the state for a given page */
  async updateRoomState(
    pageId: string,
    update: (prev: PageState) => PageState
  ) {
    const oldState = await this.getRoomState(pageId);
    const newState = update(oldState);
    await this.party.storage.put(pageId, newState);

    if (!(await this.party.storage.getAlarm())) {
      await this.party.storage.setAlarm(Date.now() + CLEANUP_ALARM_DELAY);
    }
    return newState;
  }

  /** Utility for adding a subscriber for a given room */
  async addSubscriber(roomId: string, subscriberId: string) {
    return this.updateRoomState(roomId, (state) => ({
      ...state,
      subscriberIds: [
        subscriberId,
        ...state.subscriberIds.filter((id) => id !== subscriberId),
      ],
    }));
  }
}

CounterServer satisfies Party.Worker;

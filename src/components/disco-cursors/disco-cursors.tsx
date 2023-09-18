import { Component, Host, Prop, State, h, Listen } from "@stencil/core";
import PartySocket from "partysocket";
import { CursorsMap, Cursor, NotifyMessage } from "../../../partykit/cursors";
import hash from "object-hash";

@Component({
  tag: "disco-cursors",
  styleUrl: "disco-cursors.css",
  shadow: true,
})
export class DiscoCursors {
  @Prop() host: string;

  @State() socket: PartySocket;
  @State() windowDimensions: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  @State() scrollableHeight: number = 0;
  @State() cursors: CursorsMap = {};

  @State() cursorXAbsolute: number = -1;
  @State() cursorYAbsolute: number = -1;
  @State() cursorYScroll: number = -1;

  // notify the server of the mouse position
  private doNotify = () => {
    //if (!this.windowDimensions.width || !this.windowDimensions.height) return;
    if (!this.windowDimensions.width || !this.scrollableHeight) return;
    if (this.cursorXAbsolute < 0 || this.cursorYAbsolute < 0) return;
    const notify = {
      type: "notify",
      x: Math.min(this.cursorXAbsolute / this.windowDimensions.width, 1.0),
      y: Math.min(this.cursorYScroll / this.scrollableHeight, 1.0),
      pointer: "mouse",
    } as NotifyMessage;
    //console.log("notify", this.cursorYScroll, this.scrollableHeight, notify);
    this.socket.send(JSON.stringify(notify));
  };

  // Always track the mouse position
  private onMouseMove = (e: MouseEvent) => {
    this.cursorXAbsolute = e.clientX;
    this.cursorYAbsolute = e.clientY;
    this.cursorYScroll = e.pageY;
    this.doNotify();
  };

  private onScroll = () => {
    const currentScrollY = window.scrollY || document.documentElement.scrollTop;
    this.cursorYScroll = this.cursorYAbsolute + currentScrollY;
    this.doNotify();
  };

  private updateDimensions = () => {
    this.windowDimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    this.scrollableHeight = document.documentElement.scrollHeight;
    this.doNotify();
  };

  private messageHandler = async (e: MessageEvent) => {
    const msg = await JSON.parse(e.data);
    //console.log('msg', msg);
    switch (msg.type) {
      case "sync":
        //console.log('cursor.sync', msg);
        this.cursors = { ...msg.cursors };
        break;
      case "update":
        const cursor = {
          x: msg.x,
          y: msg.y,
          pointer: msg.pointer,
          country: msg.country,
          lastUpdate: msg.lastUpdate,
        } as Cursor;
        this.cursors = { ...this.cursors, [msg.id]: cursor };
        break;
      case "remove":
        const newCursors = { ...this.cursors };
        delete newCursors[msg.id];
        this.cursors = { ...newCursors };
        break;
    }
  };

  componentWillLoad() {
    this.socket = new PartySocket({
      host: this.host,
      party: "cursors",
      room: hash(window.location.href),
    });

    this.socket.addEventListener("message", async (e) =>
      this.messageHandler(e)
    );

    // Set up a listener for window resize events
    window.addEventListener("resize", () => this.updateDimensions());

    // Listen to mouse events
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));

    // The pageY can change without the mouse moving
    window.addEventListener("scroll", () => this.onScroll());

    // @TODO add listener for touch events

    window.onload = function () {
      console.log(
        "cursors:window.onload",
        document.documentElement.scrollHeight
      );
    };
  }

  @Listen("load", { target: "window" })
  onLoad() {
    console.log("cursors:onLoad", document.documentElement.scrollHeight);
    this.updateDimensions();
  }

  private getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  private otherCursor = (cursor: Cursor) => {
    const fill = "#04f";
    const offset = 10;
    const x = cursor.x * this.windowDimensions.width - offset;
    const absoluteY = cursor.y * this.scrollableHeight - offset;
    const y =
      absoluteY - (window.scrollY || document.documentElement.scrollTop);
    /*console.log(
      "y",
      y,
      absoluteY,
      this.scrollableHeight,
      window.scrollY,
      document.documentElement.scrollTop
    );*/
    if (y < 0 || y > this.windowDimensions.height) return null;

    const flag = this.getFlagEmoji(cursor.country);
    const styles = {
      transform: `translate(${x}px, ${y}px)`,
      filter: "blur(1px)",
    };

    return (
      <div class="absolute" style={styles}>
        <svg
          height="32"
          viewBox="0 0 32 32"
          width="32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="none" fill-rule="evenodd" transform="translate(10 7)">
            <path
              d="m6.148 18.473 1.863-1.003 1.615-.839-2.568-4.816h4.332l-11.379-11.408v16.015l3.316-3.221z"
              fill="#fff"
            />
            <path
              d="m6.431 17 1.765-.941-2.775-5.202h3.604l-8.025-8.043v11.188l2.53-2.442z"
              fill={fill}
            />
          </g>
        </svg>
        <div
          class="absolute text-2xl whitespace-nowrap p-1"
          style={{ top: "10px", left: "16px" }}
        >
          {flag}
        </div>
      </div>
    );
  };

  render() {
    return (
      <Host>
        <div class="fixed top-0 left-0 -z-10 opacity-50 w-full h-full overflow-clip">
          {Object.entries(this.cursors).map(([_, cursor]) => {
            return this.otherCursor(cursor);
          })}
        </div>
      </Host>
    );
  }
}

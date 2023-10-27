import { Component, Host, Prop, State, h } from "@stencil/core";
import PartySocket from "partysocket";
import { CursorsMap, Cursor, NotifyMessage } from "../../../partykit/cursors";
import OtherCursor from "./other-cursor";
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
  @State() cursorPointer: string = "mouse";

  // notify the server of the mouse position
  private doNotify = () => {
    //if (!this.windowDimensions.width || !this.windowDimensions.height) return;
    if (!this.windowDimensions.width || !this.scrollableHeight) return;
    if (this.cursorXAbsolute < 0 || this.cursorYAbsolute < 0) return;
    const notify = {
      type: "notify",
      x: Math.min(this.cursorXAbsolute / this.windowDimensions.width, 1.0),
      y: Math.min(this.cursorYScroll / this.scrollableHeight, 1.0),
      pointer: this.cursorPointer,
    } as NotifyMessage;
    //console.log("notify", this.cursorYScroll, this.scrollableHeight, notify);
    this.socket.send(JSON.stringify(notify));
  };

  // Respond to mouse events
  private onMouseMove = (e: MouseEvent) => {
    this.cursorXAbsolute = e.clientX;
    this.cursorYAbsolute = e.clientY;
    this.cursorYScroll = e.pageY;
    this.cursorPointer = "mouse";
    this.doNotify();
  };

  // Respond to touch events
  private onTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    this.cursorXAbsolute = touch.clientX;
    this.cursorYAbsolute = touch.clientY;
    this.cursorYScroll = touch.pageY;
    this.cursorPointer = "touch";
    this.doNotify();
  };

  // Respond to touches ending
  private onTouchEnd = () => {
    this.cursorXAbsolute = -1;
    this.cursorYAbsolute = -1;
    this.cursorYScroll = -1;
    this.cursorPointer = "touch";
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
    /*console.log(
      "updateDimensions",
      this.windowDimensions,
      this.scrollableHeight
    );*/
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
      room: hash(window.location.href.split("?")[0]),
    });

    this.socket.addEventListener("message", async (e) =>
      this.messageHandler(e)
    );

    // Set up a listener for window resize events
    window.addEventListener("resize", () => this.updateDimensions());

    // The pageY can change without the mouse moving
    window.addEventListener("scroll", () => this.onScroll());

    // Listen to mouse events
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));

    // Listen for touch events
    window.addEventListener("touchmove", (e) => this.onTouchMove(e));
    window.addEventListener("touchend", () => this.onTouchEnd());
  }

  componentDidLoad() {
    //console.log("componentDidLoad", document.documentElement.scrollHeight);
    this.updateDimensions();
  }

  private otherCursor = (cursor: Cursor) => {
    const fill = "#04f";
    const x = cursor.x * this.windowDimensions.width;
    const absoluteY = cursor.y * this.scrollableHeight;
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
    //if (y < -30 || y > this.windowDimensions.height + 30) return null;

    return (
      <OtherCursor
        fill={fill}
        x={x}
        y={y}
        pointer={cursor.pointer}
        country={cursor.country}
        message={null}
        styles={{ filer: "blur(1px)" }}
      />
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

import {
  Component,
  Host,
  h,
  Element,
  Listen,
  Prop,
  State,
} from "@stencil/core";
import PartySocket from "partysocket";
import * as rangy from "rangy";
import "rangy/lib/rangy-serializer";

@Component({
  tag: "disco-select",
  styleUrl: "disco-select.css",
  shadow: true,
})
export class DiscoSelect {
  @Element() hostEl: HTMLDivElement;
  @Prop() host: string;
  @State() roomId: string;
  @State() socket: PartySocket;
  @State() selections: string[] = [];

  isContained(selection) {
    const ranges = selection.getAllRanges();
    for (const range of ranges) {
      if (
        !rangy.dom.isOrIsAncestorOf(this.hostEl, range.commonAncestorContainer)
      ) {
        // then the range isn't contained by the hostEl container
        return false;
      }
    }
    return true;
  }

  @Listen("selectionchange", { target: "document" })
  selectionchangeHandler(event) {
    console.log("selectionchange", event);
    const selection = rangy.getSelection();
    if (!selection.isCollapsed) {
      // Selection has been updated
      if (this.isContained(selection)) {
        const serialized = rangy.serializeSelection(
          selection,
          true, // omitChecksum: we're using the roomId for this
          this.hostEl
        );
        console.log("got a selection inside self", serialized);
        if (this.socket) {
          this.socket.send(
            JSON.stringify({
              type: "update",
              selection: serialized,
            })
          );
        }
      }
    }
  }

  private messageHandler = async (e: MessageEvent) => {
    const msg = await JSON.parse(e.data);
    console.log("disco-select:messageHandler", msg);
    if (msg.type === "sync") {
      this.selections = msg.selections;
    }
  };

  componentWillLoad() {
    this.roomId = rangy.getElementChecksum(this.hostEl);
    console.log("disco-select:componentWillLoad", this.roomId);

    // Connect to the partyserver for this specific room
    this.socket = new PartySocket({
      host: this.host,
      party: "selections",
      room: this.roomId,
    });
    this.socket.addEventListener("message", this.messageHandler);
  }

  render() {
    return (
      <Host>
        <slot></slot>
      </Host>
    );
  }
}

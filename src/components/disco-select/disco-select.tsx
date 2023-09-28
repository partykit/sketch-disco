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
import "rangy/lib/rangy-classapplier";
import "rangy/lib/rangy-serializer";
import "rangy/lib/rangy-highlighter";
import * as rangy from "rangy";

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
  @State() highlighter: rangy.Highlighter;

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

    if (!this.socket) return;

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
        this.socket.send(
          JSON.stringify({
            type: "update",
            selection: serialized,
          })
        );
        return;
      }
    }

    // We have no selection, or it's outside of self
    this.socket.send(JSON.stringify({ type: "remove" }));
  }

  addHighlights = () => {
    console.log("addHighlights", this.selections);

    // Remove all highlights
    this.highlighter.removeAllHighlights();

    // Collect ranges
    let ranges = [];
    for (const serializedRanges of this.selections) {
      for (const serializedRange of serializedRanges.split("|")) {
        console.log("deserializing", serializedRange);
        ranges = ranges.concat(
          rangy.deserializeRange(serializedRange, this.hostEl)
        );
      }
    }

    if (ranges.length > 0) {
      console.log("highlighting", ranges);
      this.highlighter.highlightRanges("highlight", ranges);
    }
  };

  private messageHandler = async (e: MessageEvent) => {
    const msg = await JSON.parse(e.data);
    console.log("disco-select:messageHandler", msg);
    if (msg.type === "sync") {
      this.selections = msg.selections;
      this.addHighlights();
    }
  };

  componentWillLoad() {
    this.roomId = rangy.getElementChecksum(this.hostEl);
    console.log("disco-select:componentWillLoad", this.roomId);

    // Create the highlighter
    const applier = rangy.createClassApplier("highlight", {
      ignoreWhiteSpace: true,
      tagNames: ["span", "a"],
    });
    this.highlighter = rangy.createHighlighter();
    this.highlighter.addClassApplier(applier);

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
        <span class="highlight">xx</span>
        <slot></slot>
      </Host>
    );
  }
}

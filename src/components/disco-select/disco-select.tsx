/*

NOTES

- changing the highlights in a paragraph kills the selection
    - so... avoid changing the highlights in a para with a selection
- a selection does not serialize correctly when highlights are present in the paragraph


- it is possible to fetch highlights for a give para. it is possible to destroy those highlights
- it would be possible to avoid drawing highlights that overlap with the current selection




selectionOverlapsHighlight
getHighlightsInSelection

it is possible to highlight the selection with a different classname





process:

when a new update comes in

- remove all highlights that don't share a para with selection
- add highlights that don't share a para with selection

when selection is removed

- completed refresh highlights

when selection is changed

- remove highlights that share a para






*/

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
import "rangy/lib/rangy-textrange";
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
  @State() highlights: string[] = [];
  @State() currentSelection: string;

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
        this.currentSelection = rangy.serializeSelection(
          selection,
          true, // omitChecksum: we're using the roomId for this
          this.hostEl
        );
        console.log("got a selection inside self", this.currentSelection);
        this.socket.send(
          JSON.stringify({
            type: "update",
            selection: this.currentSelection,
          })
        );
        return;
      }
    }

    // We have no selection, or it's outside of self
    this.socket.send(JSON.stringify({ type: "remove" }));
  }

  removeHighlights = () => {
    console.log("removeHighlights");
    // @ts-ignore
    CSS.highlights.clear();
  };

  addHighlights = () => {
    console.log("addHighlights", this.highlights);

    // Collect ranges
    let ranges = [];
    rangy.config.preferTextRange = true;
    for (const serializedRanges of this.highlights) {
      for (const serializedRange of serializedRanges.split("|")) {
        console.log("deserializing", serializedRange);
        ranges = ranges.concat(
          rangy.deserializeRange(serializedRange, this.hostEl)
        );
      }
    }

    if (ranges.length > 0) {
      console.log("highlighting", ranges);
      // @ts-ignore
      const highlight = new Highlight(...ranges.map((r) => r.nativeRange));
      // @ts-ignore
      CSS.highlights.set("disco-select", highlight);
    }
  };

  private messageHandler = async (e: MessageEvent) => {
    const msg = await JSON.parse(e.data);
    console.log("disco-select:messageHandler", msg);
    if (msg.type === "sync") {
      // msg.selections is a Map of connection.id => serialized selection
      // we only want the values, and we want to omit our own connection
      const syncMsg = msg as { type: "sync"; selections: Map<string, string> };
      this.highlights = Array.from(Object.entries(syncMsg.selections))
        .filter(([id]) => id !== this.socket.id)
        .map(([_, value]) => value);
      this.removeHighlights();
      this.addHighlights();
    }
  };

  componentWillLoad() {
    this.roomId = rangy.getElementChecksum(this.hostEl);
    console.log("disco-select:componentWillLoad", this.roomId);
    // If hostEl doesn't have an id, add the roomId as an id
    // id is required internally by rangy.highlighter
    if (!this.hostEl.id) {
      this.hostEl.id = this.roomId;
    }

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

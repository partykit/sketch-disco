import { Component, Host, h, Element, Listen } from "@stencil/core";
import * as rangy from "rangy";
import "rangy/lib/rangy-serializer";

@Component({
  tag: "disco-select",
  styleUrl: "disco-select.css",
  shadow: true,
})
export class DiscoSelect {
  @Element() hostEl: HTMLDivElement;

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
          false,
          this.hostEl
        );
        console.log("got a selection inside self", serialized);
      }
    }
  }

  render() {
    return (
      <Host>
        <slot></slot>
      </Host>
    );
  }
}

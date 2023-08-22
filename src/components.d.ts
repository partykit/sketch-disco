/* eslint-disable */
/* tslint:disable */
/**
 * This is an autogenerated file created by the Stencil compiler.
 * It contains typing information for all components that exist in this project.
 */
import { HTMLStencilElement, JSXBase } from "@stencil/core/internal";
export namespace Components {
    interface DiscoCursors {
        "host": string;
    }
    interface DiscoHyperlink {
        "inUse": boolean;
        "peepConnections": number;
    }
    interface DiscoRoom {
        "host": string;
    }
}
export interface DiscoHyperlinkCustomEvent<T> extends CustomEvent<T> {
    detail: T;
    target: HTMLDiscoHyperlinkElement;
}
declare global {
    interface HTMLDiscoCursorsElement extends Components.DiscoCursors, HTMLStencilElement {
    }
    var HTMLDiscoCursorsElement: {
        prototype: HTMLDiscoCursorsElement;
        new (): HTMLDiscoCursorsElement;
    };
    interface HTMLDiscoHyperlinkElement extends Components.DiscoHyperlink, HTMLStencilElement {
    }
    var HTMLDiscoHyperlinkElement: {
        prototype: HTMLDiscoHyperlinkElement;
        new (): HTMLDiscoHyperlinkElement;
    };
    interface HTMLDiscoRoomElement extends Components.DiscoRoom, HTMLStencilElement {
    }
    var HTMLDiscoRoomElement: {
        prototype: HTMLDiscoRoomElement;
        new (): HTMLDiscoRoomElement;
    };
    interface HTMLElementTagNameMap {
        "disco-cursors": HTMLDiscoCursorsElement;
        "disco-hyperlink": HTMLDiscoHyperlinkElement;
        "disco-room": HTMLDiscoRoomElement;
    }
}
declare namespace LocalJSX {
    interface DiscoCursors {
        "host"?: string;
    }
    interface DiscoHyperlink {
        "inUse"?: boolean;
        "onDiscoHyperlinkClick"?: (event: DiscoHyperlinkCustomEvent<string>) => void;
        "peepConnections"?: number;
    }
    interface DiscoRoom {
        "host"?: string;
    }
    interface IntrinsicElements {
        "disco-cursors": DiscoCursors;
        "disco-hyperlink": DiscoHyperlink;
        "disco-room": DiscoRoom;
    }
}
export { LocalJSX as JSX };
declare module "@stencil/core" {
    export namespace JSX {
        interface IntrinsicElements {
            "disco-cursors": LocalJSX.DiscoCursors & JSXBase.HTMLAttributes<HTMLDiscoCursorsElement>;
            "disco-hyperlink": LocalJSX.DiscoHyperlink & JSXBase.HTMLAttributes<HTMLDiscoHyperlinkElement>;
            "disco-room": LocalJSX.DiscoRoom & JSXBase.HTMLAttributes<HTMLDiscoRoomElement>;
        }
    }
}

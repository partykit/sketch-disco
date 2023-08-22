# [WIP] sketch-disco

_WORK IN PROGRESS -- Not yet ready for sharing!_

Implements web components under the 'disco-party' project name.

These components are intended to add a sense of translucency and presence to static webpages.

Right now there is:

- disco-room -- links internal to the site are badged with how many people are connected at the other end, and when another user follows a hypoerlink then it bounces for everyone else.

![image](/assets/peep.png)

## Experimental!

This component was created during [Matt](https://interconnected.org)'s summer 2023 residency. The purpose is to experiment with multiplayer interactions, and simultaneously see what PartyKit can do. It's called a sketch because it's lightweight and quick, and because we learn something in making it.

## Usage

### EITHER: (1A) Self-hosting

Build the components with `npm run build` and then copy the `dist` directory to your webroot.

Then, in the \<head> of every page you want to use the components, add:

```html
<script
  type="module"
  src="/path-to-your-disco-party-dist/disco-party.esm.js"
></script>
```

### OR: (1B) CDN

Add the following to the \<head> of every page you want to use the components:

```html
<script type="module" src="https://unpkg.com/disco-party@0.0.3"></script>
```

### (3) Start the server

The PartyKit server is your backend.

In the root of this repo, run:

```bash
npx partykit dev
```

That will give you a host of `127.0.0.1:1999` (you'll need this later).

Or you can deploy the server publicly. Run:

```bash
npx partykit deploy
```

And your host will be something like `disco-party.USERNAME.partykit.dev`.

### (4) Add the disco-room component to your pages

In your site template, wrap the content that you want to be part of the disco-room in a `<disco-room>` tag.

```html
<disco-room host="127.0.0.1:1999">
  <h1>My disco room</h1>
  <p>Some content</p>
  <a href="/some-link">A link</a>
</disco-room>
```

## Bugs

- [x] When disco-room receives an 'update' message, it zeros the number of peep-connections for all container disco-hyperlinks. It should not, because update is used as a batch sync at the beginning, but also incremental updates.

## To do

- [x] Publish the web component to npmjs so anyone can use it
- [ ] Deploy the PartyKit server so that there's a public host to use
- [ ] Remove debug logging
- [ ] Add documentation
- [ ] Add disco-presence to show how many people are on the page (this is hardcoded at the moment)
- [ ] Add disco-cursors with frosted glass cursors
- [ ] Allow a page to have multiple active "zones" in the same room (so boilerplate can be ignored)

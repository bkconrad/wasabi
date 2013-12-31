---
title: Introduction
category: overview
layout: guide
---

What Is This Thing?
---

Wasabi was designed as an easy to use, efficient network game library. More generally, Wasabi is an object replication library supporting object lifetime management, natural RPC invocation, and tight binary encoding of data.

"Replication" in this sense means giving two or more processes (typically a server and some clients) functionally identical copies of the same JavaScript object. A natural extension of this is to then allow RPC invocation using the natural method invocation style, e.g. `myObject.rpcFoo('Hello, world!')`. Combined with efficient synchronization of replicas via streams of updates, Wasabi is a full-solution game networking library that combines the efficiency of binary encoding, the power of intuitive object replication, and code sharing of Node.js combined with browser-side JavaScript. 

Although it was designed for games, Wasabi has applications in distributed simulation systems and peer-to-peer data sharing, and has been built to support a variety of network topologies.

Why Would You Do This?
---

I agree that there are some mental gymnastics needed to justify the existence of such a contraption. My reasoning is basically as follows:

  1. JavaScript is the most easily deployed programming language in existence (no installation or downloads, just distribute a URL)
  2. In modern browsers, JavaScript has nearly all of the faculties needed for modern real-time games (3D graphics, audio, hardware acceleration, performant execution, networking support)
  3. The only thing missing is a bandwidth-efficient network library built for this purpose
  4. The code-sharing enabled by Node.js makes it an ideal platform for back-end servers

From here, I believe it follows that there is a need for a JS replication library built for bit-level efficiency. The time is ripe for Wasabi (or maybe something even better) to enable developers to easily write the next wave of real-time multiplayer JS games.
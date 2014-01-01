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

---
title: Introduction
category: overview
layout: guide
---

What Is This Thing?
---

Wasabi was designed as a super-efficient network game library. More generally, Wasabi is an object replication library supporting fast, tight, binary encoding of data.

"Replication" in this sense means giving two or more processes (typically a server and some clients) functionally identical copies of the same JavaScript object. Although it was designed for games, Wasabi has applications in distributed simulation systems and peer-to-peer data sharing.

Why Would You Do This?
---

I concede that there are some mental gymnastics needed to justify the existence of such a contraption. My reasoning is basically as follows:

  1. JavaScript is the most easily deployed programming language in existence (no installation or downloads, just distribute a URL)
  2. In modern browsers, JavaScript has nearly all of the faculties needed for modern realtime games (3D graphics, audio, hardware acceleration, performant execution, low level networking support)
  3. The only thing missing is a bandwidth-efficient network library built for this purpose
  4. The code-sharing enabled by NodeJS makes it an ideal platform for backend servers

From here, I believe it follows that there is a need for a JS replication library built for bit-level efficiency. The time is ripe for Wasabi (or maybe something even better) to enable developers to easily write the next wave of realtime multiplayer JS games.
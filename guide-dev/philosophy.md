---
title: Philosophy
layout: guide
category: overview
---

Simple
---
The main design choice of Wasabi is to be simple to add into an existing project, or to start a new project with. To accomplish this, Wasabi embraces the notion of convention over configuration. RPCs and `serialize` functions are auto-detected based on simple, easy-to-remember rules that save you from tedious configuration constructs.

Additionally, Wasabi will make educated guesses to get you off the ground. For example, RPC declarations are parsed to detect the number of arguments they take, and will deduce the types of arguments passed to the invocations. Wasabi does this in a reliable and consistent manner that generally "just works".

Then Powerful
---
Once you're through the rapid prototyping phase, Wasabi includes mechanisms that let you fine-tune performance in exchange for a little more configuration. RPCs allow for optional `*Args` methods to be defined, saving CPU (from deduction) and bandwidth (from type encoding) once you're ready for production.

Moreover, Wasabi allows you to specify the number of bits to use when encoding data, given control with maximum granularity over the network performance of your real-time application.

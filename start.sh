#!/bin/sh
nginx
exec bun run dist/server.js

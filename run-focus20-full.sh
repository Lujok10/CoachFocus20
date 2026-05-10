#!/usr/bin/env bash
set -e
npm install
npm run prisma:generate
npm run dev:full

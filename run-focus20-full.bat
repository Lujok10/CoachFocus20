@echo off
npm install
npm run prisma:generate
npm run dev:full
pause

# radio-api runtime. Compile TypeScript on the host
# (`npm run build:server -w radio-station`); the image copies dist-server
# and installs Linux production deps (pg). No TypeScript compile in Docker.

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY apps/radio-station/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY apps/radio-station/dist-server ./dist-server
USER node
EXPOSE 3000
CMD ["node", "dist-server/index.js"]

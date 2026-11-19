FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY engine/package.json engine/package.json
COPY packages/sdk-mongodb/package.json packages/sdk-mongodb/package.json
RUN npm install --omit=dev
COPY engine engine
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "engine/src/server.js"]

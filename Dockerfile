FROM node:20 as base
WORKDIR /app
COPY package-lock.json package.json ./

FROM base as builder
RUN npm install
COPY . .
RUN npm run build

FROM base as runner
RUN npm install --omit dev
COPY --from=builder /app/dist ./dist
CMD npm run start

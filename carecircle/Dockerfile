FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV TZ=Asia/Kolkata
CMD ["node","server.js"]

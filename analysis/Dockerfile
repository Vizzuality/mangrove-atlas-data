FROM node:10.21.0-alpine
ENV GOOGLE_APPLICATION_CREDENTIALS=/home/credentials.json
WORKDIR /home
COPY package.json package-lock.json .env credentials.json index.js helper_functions.js utilities.js ./
RUN npm install
EXPOSE 8080

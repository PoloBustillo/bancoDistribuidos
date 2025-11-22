# Use Node.js LTS version
FROM node:20-alpine

# Install netcat for wait script
RUN apk add --no-cache netcat-openbsd

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install --include=dev

# Copy source code
COPY . .

# Copy wait script
COPY wait-for-rabbitmq.sh /wait-for-rabbitmq.sh
RUN chmod +x /wait-for-rabbitmq.sh

# Build TypeScript
RUN npm run build

# Expose ports
EXPOSE 4001 50051

# Start the application with wait script
CMD ["/wait-for-rabbitmq.sh", "rabbitmq", "npm", "start"]

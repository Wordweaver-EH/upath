FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start dev server accessible from outside container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
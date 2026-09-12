# Crypton web — builds the Angular app and serves it with nginx.
# Build from the repository root:  docker build -t crypton-web .
# Debian rather than Alpine: the Angular build pulls native binaries (esbuild, lightningcss)
# and the glibc builds are the well-trodden path.
FROM node:24-bookworm-slim AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx ng build

FROM nginx:1.29-alpine AS runtime
# The nginx entrypoint runs envsubst over /etc/nginx/templates, so API_HOST is
# substituted into the config when the container starts.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/crypton/browser /usr/share/nginx/html

# Where nginx forwards /api. Inside docker compose this is the API service name.
ENV API_HOST=api:8080 \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    NGINX_ENVSUBST_FILTER=^API_HOST$
EXPOSE 8080

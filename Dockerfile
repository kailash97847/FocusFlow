# FocusFlow — production image (static PWA on nginx).
# Build:  docker build -t focusflow .
# Run:    docker run -p 8080:80 focusflow
FROM nginx:1.27-alpine

# Static site: app at /app/, landing at /landing/ (landing is also the index).
COPY app/ /usr/share/nginx/html/app/
COPY landing/ /usr/share/nginx/html/landing/

# Gzip + security headers + SPA-friendly routing for static assets.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1/app/index.html >/dev/null 2>&1 || exit 1

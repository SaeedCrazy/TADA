# Shared by the http and https servers.
client_max_body_size 4m;
server_tokens off;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;

# The Tada website (static, from the repository root) is served as-is.
root /srv/site;
location = / { try_files /index.html =404; }
location = /index.html { try_files $uri =404; }
location = /tada.html { try_files $uri =404; }
location ~ ^/(assets|css|js|v1|v2)/ { try_files $uri =404; expires 7d; }
location ~ /\. { deny all; }

# API: straight to Fastify, with the real client address for rate limits.
location /api/ {
  proxy_pass http://api:4000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Connection "";
}
# The bar screen's live stream must not be buffered.
location /api/staff/orders/stream {
  proxy_pass http://api:4000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 1h;
}
# Product photos uploaded from the admin panel.
location /uploads/ {
  alias /srv/uploads/;
  expires 30d;
  add_header X-Content-Type-Options nosniff always;
  add_header Content-Security-Policy "default-src 'none'" always;
}

# Everything else: the shop, admin panel and bar screen (Next.js).
location / {
  proxy_pass http://web:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

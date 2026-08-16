FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app

# Runtime only needs express / pg / pngjs — the React + Vite half of the
# dependency tree is build-time and stays behind in the builder stage.
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Background removal runs locally on CPU (tools/bg-server.py) instead of
# calling a SaaS cutout API, so the image carries Python + onnxruntime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages withoutbg

# Bake the 455 MB open-weights model into the image. Downloading it on
# first use would mean a multi-minute stall on every cold start, and a
# hard dependency on Hugging Face being reachable from the container.
# The sidecar .json has to sit next to the .onnx file.
ENV WITHOUTBG_MODEL_PATH=/opt/withoutbg/withoutbg-open-weights.onnx
RUN mkdir -p /opt/withoutbg \
    && curl -fsSL -o /opt/withoutbg/withoutbg-open-weights.onnx \
       https://huggingface.co/withoutbg/withoutbg-openweights-onnx/resolve/main/withoutbg-open-weights.onnx \
    && curl -fsSL -o /opt/withoutbg/withoutbg-open-weights.onnx.json \
       https://huggingface.co/withoutbg/withoutbg-openweights-onnx/resolve/main/withoutbg-open-weights.onnx.json

COPY --from=builder /app/dist ./dist
COPY api ./api
COPY tools ./tools
COPY server.js docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Fail the build, not production, if the model or the SDK's call shape
# is wrong: generate a tiny PNG and run one real cutout through it.
RUN python3 -c "\
from PIL import Image; Image.new('RGB', (64, 64), (12, 200, 90)).save('/tmp/probe.png')" \
    && python3 -c "\
from withoutbg import WithoutBG; \
WithoutBG.open_weights().remove_background('/tmp/probe.png').save('/tmp/probe-out.png'); \
from PIL import Image; \
print('cutout mode', Image.open('/tmp/probe-out.png').mode)" \
    && rm -f /tmp/probe.png /tmp/probe-out.png

ENV PORT=8080
EXPOSE 8080
CMD ["./docker-entrypoint.sh"]

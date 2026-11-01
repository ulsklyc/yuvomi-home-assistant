# The Home Assistant app is a thin layer on top of the regular Yuvomi image:
# it only adds a launcher that turns the app options into environment
# variables. The application itself is untouched.
# The upstream image is multi-arch; the Supervisor builds with --platform and
# no longer passes BUILD_FROM once build.yaml is gone. Keep the tag equal to
# the version in config.yaml.
ARG BUILD_FROM=ghcr.io/ulsklyc/yuvomi:2.83.0
FROM ${BUILD_FROM}

COPY rootfs /
RUN chmod 0755 /ha/run.sh

ARG BUILD_ARCH
ARG BUILD_VERSION
LABEL \
  io.hass.name="Yuvomi" \
  io.hass.description="Self-hosted family planner" \
  io.hass.type="addon" \
  io.hass.arch="${BUILD_ARCH}" \
  io.hass.version="${BUILD_VERSION}"

# Used by the Supervisor watchdog. The upstream image has no curl, so node
# checks the health endpoint. start-period covers migrations on first start.
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

WORKDIR /app
ENTRYPOINT ["/ha/run.sh"]
CMD []

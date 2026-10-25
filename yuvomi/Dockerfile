# The Home Assistant app is a thin layer on top of the regular Yuvomi image:
# it only adds a launcher that turns the app options into environment
# variables. The application itself is untouched.
ARG BUILD_FROM
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

WORKDIR /app
ENTRYPOINT ["/ha/run.sh"]
CMD []

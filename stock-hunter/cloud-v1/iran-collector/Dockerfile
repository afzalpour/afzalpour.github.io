FROM python:3.13-slim

ARG APP_UID=10001
ARG APP_GID=10001

RUN groupadd --gid "${APP_GID}" stockhunter \
 && useradd --uid "${APP_UID}" --gid "${APP_GID}" --home-dir /var/lib/stock-hunter-collector --create-home --shell /usr/sbin/nologin stockhunter

WORKDIR /app
COPY --chown=stockhunter:stockhunter collector.py /app/collector.py
RUN chmod 0755 /app/collector.py \
 && mkdir -p /var/lib/stock-hunter-collector \
 && chown -R stockhunter:stockhunter /var/lib/stock-hunter-collector

USER stockhunter
VOLUME ["/var/lib/stock-hunter-collector"]

ENTRYPOINT ["python3", "/app/collector.py"]
CMD ["--loop"]

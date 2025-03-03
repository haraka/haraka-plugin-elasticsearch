#!/bin/sh

ES_URL=https://user:pass@host.example.com:9200

for _p in connection email-message results plugin-access plugin-asn plugin-bounce plugin-dkim plugin-fcrdns plugin-geoip plugin-helo_checks plugin-karma plugin-known-senders plugin-limit plugin-p0f plugin-rspamd plugin-spamassassin plugin-spf; do
  curl -k -X GET "$ES_URL/_component_template/haraka-$_p" | jq -S > $_p.json
done

curl -k -X GET "$ES_URL/_index_template/haraka-results" | jq -S > ../index/composable.json

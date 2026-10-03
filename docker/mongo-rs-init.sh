#!/usr/bin/env bash
# mongo-rs-init.sh
#
# Initialises a single-node MongoDB replica set named "rs0".
#
# This script is run by the mongo-init service in docker-compose.yml
# exactly once after mongo is healthy. Running it again on an already-
# initialised replica set is safe — rs.status() will show it is already
# PRIMARY and the initiate call is skipped.

set -euo pipefail

echo "⏳  Waiting for mongod to accept connections…"
until mongosh --host mongo:27017 --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  sleep 1
done

echo "🔧  Checking replica-set status…"
RS_STATUS=$(mongosh --host mongo:27017 --quiet --eval \
  "try { rs.status().ok } catch(e) { 0 }" 2>/dev/null || echo "0")

if [ "$RS_STATUS" = "1" ]; then
  echo "✅  Replica set already initialised. Nothing to do."
  exit 0
fi

echo "🚀  Initiating replica set rs0…"
mongosh --host mongo:27017 --quiet --eval '
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }]
  });
'

echo "⏳  Waiting for PRIMARY election…"
until mongosh --host mongo:27017 --quiet --eval \
  "db.adminCommand('hello').isWritablePrimary" 2>/dev/null | grep -q "true"; do
  sleep 1
done

echo "✅  Replica set rs0 is PRIMARY and ready."

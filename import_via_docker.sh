#!/bin/bash

# Import script usando Python dentro il container Docker
# Non richiede psycopg2 installato sul server host

DUMP_FILE="$1"
DB_CONTAINER="quant_tools_db"

if [ -z "$DUMP_FILE" ]; then
    echo "Usage: ./import_via_docker.sh <dump_file.sql>"
    exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ File $DUMP_FILE non trovato!"
    exit 1
fi

echo "======================================"
echo "QUANT TOOLS - IMPORT VIA DOCKER"
echo "======================================"
echo ""

# Copia dump nel container
echo "📦 Copia dump nel container..."
docker cp "$DUMP_FILE" $DB_CONTAINER:/tmp/import_dump.sql

# Copia script Python nel container
echo "📦 Copia script Python nel container..."
docker cp import_data.py $DB_CONTAINER:/tmp/import_data.py

# Esegui import dentro il container
echo "🚀 Esecuzione import..."
docker exec -e DATABASE_URL="postgresql://quant_user:quant_password_2024@localhost:5432/quant_tools" \
    $DB_CONTAINER python3 /tmp/import_data.py /tmp/import_dump.sql

# Cleanup
echo ""
echo "🧹 Pulizia..."
docker exec $DB_CONTAINER rm -f /tmp/import_dump.sql /tmp/import_data.py

echo ""
echo "✅ COMPLETATO!"

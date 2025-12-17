#!/bin/bash
# Re-generate the seed file (optional, ensures freshness)
python3 scripts/generate_seed.py

# Execute against Docker container
echo "Seeding Neo4j database..."
cat scripts/seed.cypher | docker exec -i ganoderma-neo4j cypher-shell -u neo4j -p password

echo "Database seeded successfully!"

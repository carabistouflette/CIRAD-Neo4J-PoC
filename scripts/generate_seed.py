import random
import datetime

# Configuration
NUM_ISOLATES = 10
NUM_ORTHOGROUPS = 50
NUM_GENES = 500

COUNTRIES = ["Indonesia", "Malaysia", "Cameroon", "Thailand", "Papua New Guinea", "Brazil", "Columbia"]
HOSTS = ["Elaeis guineensis", "Elaeis oleifera", "Hybrid"]
GENE_PREFIXES = ["Tox", "Eff", "Reg", "Met", "Tra", "Str"]
DESCRIPTIONS = [
    "Involved in secondary metabolism",
    "Putative effector protein",
    "Transcription factor related to virulence",
    "Cell wall degrading enzyme",
    "Transporter protein",
    "Unknown function domain",
    "Conserved hypothetical protein",
    "Cytochrome P450 monooxygenase"
]

def generate_date():
    start_date = datetime.date(2010, 1, 1)
    end_date = datetime.date(2024, 1, 1)
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    random_date = start_date + datetime.timedelta(days=random_number_of_days)
    return random_date.strftime("%Y-%m-%d")

cypher_lines = []

cypher_lines.append("// Clear Database")
cypher_lines.append("MATCH (n) DETACH DELETE n;")
cypher_lines.append("")

# 1. Generate Isolates
isolates = []
cypher_lines.append("// Isolates")
for i in range(1, NUM_ISOLATES + 1):
    country = random.choice(COUNTRIES)
    name = f"G. boninense {country[:3].upper()}{i}"
    host = random.choice(HOSTS)
    date = generate_date()
    # Isolate ID in Java is GeneratedValue (Long), but we can let Neo4j assign ID or match by name.
    # For seeding, we'll CREATE and use a variable to reference if needed, or just match by name later.
    # Actually, simplistic approach: CREATE separate statements.
    
    # We store the isolate_id (name) to link genes later
    isolates.append(name)
    
    line = f"CREATE (:Isolate {{name: '{name}', originCountry: '{country}', host: '{host}', collectionDate: '{date}'}});"
    cypher_lines.append(line)

cypher_lines.append("")

# 2. Generate Orthogroups
orthogroups = []
cypher_lines.append("// Orthogroups")
for i in range(1, NUM_ORTHOGROUPS + 1):
    og_id = f"OG{i:05d}"
    orthogroups.append(og_id)
    # geneCount will be updated or we can just mock it. Let's mock it roughly.
    count = random.randint(1, 20)
    line = f"CREATE (:Orthogroup {{groupId: '{og_id}', geneCount: {count}}});"
    cypher_lines.append(line)

cypher_lines.append("")

# 3. Generate Genes
cypher_lines.append("// Genes")
for i in range(1, NUM_GENES + 1):
    gene_id = f"Gbon_{i:06d}"
    symbol = f"{random.choice(GENE_PREFIXES)}{random.randint(1, 100)}"
    biotype = "protein_coding"
    desc = random.choice(DESCRIPTIONS)
    
    # Relationships
    isolate_name = random.choice(isolates)
    og_id = random.choice(orthogroups)
    
    # Create Gene and Relations in one go or MATCH
    # Efficient Cypher: MATCH Isolate and OG, then CREATE Gene
    
    line = (
        f"MATCH (iso:Isolate {{name: '{isolate_name}'}}) "
        f"MATCH (og:Orthogroup {{groupId: '{og_id}'}}) "
        f"CREATE (g:Gene {{geneId: '{gene_id}', symbol: '{symbol}', biotype: '{biotype}', description: '{desc}'}}) "
        f"CREATE (g)-[:FOUND_IN]->(iso) "
        f"CREATE (g)-[:BELONGS_TO_OG]->(og);"
    )
    cypher_lines.append(line)

# Write to file
with open("scripts/seed.cypher", "w") as f:
    f.write("\n".join(cypher_lines))

print(f"Generated scripts/seed.cypher with {NUM_ISOLATES} isolates, {NUM_ORTHOGROUPS} orthogroups, and {NUM_GENES} genes.")
print("Run command: cypher-shell -u neo4j -p password < scripts/seed.cypher")

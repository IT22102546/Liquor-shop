#!/bin/bash

# LearnApp Platform - Complete Database Reset & Seed Script
# This script resets the database and seeds it with fresh data

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     LearnApp Platform - Database Reset & Seed Automation       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/.." || exit

echo "📂 Current directory: $(pwd)"
echo ""

# Step 1: Check if backend is running
echo "1️⃣  Checking for running backend processes..."
if pgrep -f "nest start" > /dev/null; then
    echo "   ⚠️  Found running backend process. Please stop it first."
    echo "   Press Ctrl+C in the backend terminal, then run this script again."
    echo ""
    exit 1
else
    echo "   ✅ No backend processes detected"
    echo ""
fi

# Step 2: Reset database
echo "2️⃣  Resetting database..."
echo "   ⚠️  WARNING: This will delete ALL data!"
echo ""

read -p "   Are you sure you want to continue? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo ""
    echo "❌ Operation cancelled by user"
    echo ""
    exit 0
fi

echo ""
echo "   Running database reset..."
echo ""

if npx prisma migrate reset --force --skip-seed; then
    echo ""
    echo "   ✅ Database reset complete!"
    echo ""
else
    echo ""
    echo "   ❌ Database reset failed"
    echo ""
    exit 1
fi

# Step 3: Generate Prisma Client
echo "3️⃣  Generating Prisma Client..."
if npx prisma generate; then
    echo "   ✅ Prisma Client generated"
    echo ""
else
    echo "   ❌ Prisma generate failed"
    echo ""
    exit 1
fi

# Step 4: Run seed script
echo "4️⃣  Seeding database with fresh data..."
echo "   This may take a few minutes..."
echo ""

if npx ts-node prisma/seed.ts; then
    echo ""
    echo "   ✅ Database seeded successfully!"
    echo ""
else
    echo ""
    echo "   ❌ Database seeding failed"
    echo ""
    exit 1
fi

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            DATABASE RESET & SEED COMPLETED! 🎉                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📝 Next steps:"
echo "   1. Start the backend: npm run start:dev"
echo "   2. Check http://localhost:5000/api/docs for API documentation"
echo "   3. Login with test credentials (check seed output above)"
echo ""

echo "✨ Database is ready to use!"
echo ""

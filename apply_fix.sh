#!/bin/bash

# Script to apply the numeric overflow fix to the database

echo "Applying numeric overflow fix to style_profiles table..."

# Check if psql is available
if ! command -v psql &> /dev/null
then
    echo "psql could not be found. Please ensure PostgreSQL is installed and in PATH."
    exit 1
fi

# Apply the fix
psql -d designer_bff -f FIX_NUMERIC_OVERFLOW.sql

if [ $? -eq 0 ]; then
    echo "Numeric overflow fix applied successfully!"
else
    echo "Failed to apply numeric overflow fix."
    exit 1
fi